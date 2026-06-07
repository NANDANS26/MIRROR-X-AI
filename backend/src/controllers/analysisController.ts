/**
 * analysisController.ts — Analysis endpoint handlers.
 *
 * POST /api/analysis/upload  — Upload screenshot → create session → run pipeline in background
 * POST /api/analysis/url     — Submit URL → scrape → create session → run pipeline in background
 * GET  /api/analysis/history — List authenticated user's sessions (max 100, desc)
 * DELETE /api/analysis/:sessionId — Delete session and associated data
 *
 * Validates: Requirements 2.1, 9.8, 10.1, 10.2, 10.4
 */

import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

import { asyncHandler } from "../utils/asyncHandler";
import { AuthRequest } from "../middleware/authMiddleware";
import { validateUrl } from "../utils/urlValidator";
import { captureUrl } from "../services/scraperService";
import { runPipeline } from "../services/pipelineOrchestrator";
import { prisma } from "../database/prisma";
import { getUserSessions, deleteSession } from "../database/sessionRepository";

const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// POST /api/analysis/upload
// ---------------------------------------------------------------------------
export const uploadAnalysis = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // socketId can come from query param OR from the multipart body field
    const socketId: string =
      (req.query.socketId as string) ||
      (req.body?.socketId as string) ||
      "";

    // Create a pending session immediately so we can return sessionId
    const session = await prisma.analysisSession.create({
      data: {
        userId: req.user!.userId,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        sourceType: "upload",
        sourceFilename: req.file.filename,
        screenshotPath: req.file.path,
        status: "pending",
      },
    });

    // Run the pipeline in the background — don't await it
    setImmediate(() => {
      runPipeline(session.id, socketId, {
        type: "upload",
        filePath: req.file!.path,
      }).catch((err: unknown) => {
        console.error("[analysisController] Pipeline error:", err);
      });
    });

    return res.status(202).json({
      success: true,
      sessionId: session.id,
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/analysis/url
// ---------------------------------------------------------------------------
export const urlAnalysis = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { url, socketId = "" } = req.body as { url: string; socketId?: string };

    // Validate URL (Requirement 2.3)
    const validation = validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: "INVALID_URL",
        message: "Please provide a valid HTTP or HTTPS URL.",
      });
    }

    // Scrape the URL
    let scrapedData;
    try {
      scrapedData = await captureUrl(url);
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "Error";
      const message = err instanceof Error ? err.message : "Unknown error";

      if (name === "ScraperTimeoutError") {
        return res.status(504).json({
          success: false,
          error: "SCRAPER_TIMEOUT",
          message,
        });
      }

      if (name === "PartialRenderError") {
        return res.status(422).json({
          success: false,
          error: "PARTIAL_RENDER",
          message,
        });
      }

      return res.status(502).json({
        success: false,
        error: "SCRAPER_ERROR",
        message,
      });
    }

    // Create a pending session immediately
    const session = await prisma.analysisSession.create({
      data: {
        userId: req.user!.userId,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        sourceType: "url",
        sourceUrl: url,
        screenshotPath: scrapedData.screenshotPath,
        pageTitle: scrapedData.pageTitle,
        metaDescription: scrapedData.metaDescription,
        status: "pending",
      },
    });

    // Run the pipeline in the background
    setImmediate(() => {
      runPipeline(session.id, socketId, {
        type: "url",
        scrapedData,
      }).catch((err: unknown) => {
        console.error("[analysisController] Pipeline error:", err);
      });
    });

    return res.status(202).json({
      success: true,
      sessionId: session.id,
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/analysis/history
// ---------------------------------------------------------------------------
export const getHistory = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const sessions = await getUserSessions(req.user!.userId);

    return res.status(200).json({
      success: true,
      sessions,
    });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/analysis/:sessionId
// ---------------------------------------------------------------------------
export const removeSession = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { sessionId } = req.params;
    const safeSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;

    // Verify ownership
    const session = await prisma.analysisSession.findUnique({
      where: { id: safeSessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (session.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    // Delete uploaded file from disk (best-effort)
    if (session.screenshotPath) {
      try {
        const filePath = path.resolve(session.screenshotPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore file deletion errors — DB delete is authoritative
      }
    }

    // Delete session and all cascade records from Prisma
    await deleteSession(safeSessionId);

    return res.status(204).send();
  }
);
