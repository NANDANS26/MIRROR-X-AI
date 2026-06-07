/**
 * reportController.ts — PDF report generation and streaming endpoint.
 *
 * GET /api/report/:sessionId — Call AI Service /report/generate, stream PDF binary to client.
 *
 * Validates: Requirements 8.1–8.6
 */

import { Response } from "express";
import axios from "axios";

import { asyncHandler } from "../utils/asyncHandler";
import { AuthRequest } from "../middleware/authMiddleware";
import { getSession, updateSessionReport } from "../database/sessionRepository";
import { ENV } from "../configs/env";

export const createAnalysisReport = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const sessionId =
      typeof req.params.id === "string" ? req.params.id : req.params.sessionId;

    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Verify ownership
    if (session.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    // Build the session_data payload for the AI Service
    const sessionData = {
      session_id: session.id,
      source_url: session.sourceUrl ?? undefined,
      source_filename: session.sourceFilename ?? undefined,
      screenshot_path: session.screenshotPath ?? undefined,
      detected_patterns: session.detectedPatternsJson ?? [],
      scores: session.scoresJson ?? {},
      simulation_results: session.simulationResultsJson ?? [],
    };

    // Call AI Service POST /report/generate — receive PDF binary
    let pdfBuffer: Buffer;

    try {
      const aiRes = await axios.post(
        `${ENV.AI_SERVICE_URL}/report/generate`,
        {
          session_id: session.id,
          analysis_result: sessionData,
        },
        {
          responseType: "arraybuffer",
          timeout: 35000, // 30s generation + buffer
        }
      );

      pdfBuffer = Buffer.from(aiRes.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Report generation failed";
      return res.status(500).json({
        error: "REPORT_GENERATION_FAILED",
        message,
        retryable: true,
      });
    }

    // Persist reportExpiresAt = now + 24 hours
    await updateSessionReport(session.id, `report-${session.id}.pdf`);

    // Stream PDF binary to client
    const filename = `mirrorx-report-${session.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));

    return res.send(pdfBuffer);
  }
);
