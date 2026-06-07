/**
 * analysisController.ts
 *
 * Upload flow:
 *   1. multer puts file bytes in req.file.buffer (memoryStorage)
 *   2. Upload to Cloudinary → get secure_url
 *   3. Create AnalysisSession with imageUrl = secure_url
 *   4. Kick off pipeline (passes buffer + imageUrl)
 *
 * URL flow:
 *   1. Scrape with axios+cheerio
 *   2. Create AnalysisSession with imageUrl = "" (no screenshot for URL scraping)
 *   3. Kick off pipeline
 */

import { Response }   from "express";
import { asyncHandler }  from "../utils/asyncHandler";
import { AuthRequest }   from "../middleware/authMiddleware";
import { validateUrl }   from "../utils/urlValidator";
import { captureUrl }    from "../services/scraperService";
import { runPipeline }   from "../services/pipelineOrchestrator";
import { uploadImageBuffer, deleteImage } from "../services/cloudinaryService";
import { prisma }        from "../database/prisma";
import { getUserSessions, deleteSession } from "../database/sessionRepository";

const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// POST /api/analysis/upload
// ---------------------------------------------------------------------------
export const uploadAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const socketId: string =
    (req.query.socketId as string) ||
    (req.body?.socketId as string) ||
    "";

  // 1. Upload image to Cloudinary — get a persistent URL
  let imageUrl: string;
  let cloudinaryPublicId: string;
  try {
    const uploaded = await uploadImageBuffer(req.file.buffer, req.file.mimetype);
    imageUrl         = uploaded.secure_url;
    cloudinaryPublicId = uploaded.public_id;
  } catch (uploadErr) {
    console.error("[upload] Cloudinary upload failed:", uploadErr);
    return res.status(500).json({
      success: false,
      message: "Failed to store uploaded image. Please try again.",
    });
  }

  // 2. Create a pending session — imageUrl is now a real Cloudinary URL
  let session;
  try {
    session = await prisma.analysisSession.create({
      data: {
        userId:        req.user!.userId,
        expiresAt:     new Date(Date.now() + SESSION_EXPIRY_MS),
        sourceType:    "upload",
        sourceFilename: req.file.originalname || "upload.png",
        imageUrl,
        status: "pending",
      },
    });
  } catch (dbErr) {
    // If DB fails, clean up the Cloudinary image we just uploaded
    await deleteImage(cloudinaryPublicId);
    console.error("[upload] Session creation failed:", dbErr);
    return res.status(500).json({ success: false, message: "Failed to create analysis session." });
  }

  // 3. Run pipeline in background — passes buffer for OCR + imageUrl for DB/report
  setImmediate(() => {
    runPipeline(session.id, socketId, {
      type:             "upload",
      fileBuffer:       req.file!.buffer,
      fileMimetype:     req.file!.mimetype,
      fileOriginalname: req.file!.originalname,
      imageUrl,
    }).catch((err: unknown) => {
      console.error("[analysisController] Pipeline error:", err);
    });
  });

  return res.status(202).json({ success: true, sessionId: session.id });
});

// ---------------------------------------------------------------------------
// POST /api/analysis/url
// ---------------------------------------------------------------------------
export const urlAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url, socketId = "" } = req.body as { url: string; socketId?: string };

  const validation = validateUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: "INVALID_URL", message: "Please provide a valid HTTP or HTTPS URL." });
  }

  let scrapedData;
  try {
    scrapedData = await captureUrl(url);
  } catch (err: unknown) {
    const name    = err instanceof Error ? err.name    : "Error";
    const message = err instanceof Error ? err.message : "Unknown error";
    if (name === "ScraperTimeoutError") return res.status(504).json({ success: false, error: "SCRAPER_TIMEOUT",   message });
    if (name === "PartialRenderError")  return res.status(422).json({ success: false, error: "PARTIAL_RENDER",    message });
    return res.status(502).json({ success: false, error: "SCRAPER_ERROR", message });
  }

  // URL sessions have no uploaded image — imageUrl is empty string
  const session = await prisma.analysisSession.create({
    data: {
      userId:          req.user!.userId,
      expiresAt:       new Date(Date.now() + SESSION_EXPIRY_MS),
      sourceType:      "url",
      sourceUrl:       url,
      imageUrl:        "",
      pageTitle:       scrapedData.pageTitle,
      metaDescription: scrapedData.metaDescription,
      status:          "pending",
    },
  });

  setImmediate(() => {
    runPipeline(session.id, socketId, { type: "url", scrapedData })
      .catch((err: unknown) => console.error("[analysisController] Pipeline error:", err));
  });

  return res.status(202).json({ success: true, sessionId: session.id });
});

// ---------------------------------------------------------------------------
// GET /api/analysis/history
// ---------------------------------------------------------------------------
export const getHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const sessions = await getUserSessions(req.user!.userId);
  return res.status(200).json({ success: true, sessions });
});

// ---------------------------------------------------------------------------
// DELETE /api/analysis/:sessionId
// ---------------------------------------------------------------------------
export const removeSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const raw = req.params.sessionId;
  const sessionId = Array.isArray(raw) ? raw[0] : raw;

  const session = await prisma.analysisSession.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ success: false, message: "Session not found" });
  if (session.userId !== req.user!.userId) return res.status(403).json({ success: false, message: "Forbidden" });

  await deleteSession(sessionId);
  return res.status(204).send();
});
