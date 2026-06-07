/**
 * reportController.ts
 *
 * Sends imageUrl (Cloudinary URL) to the AI report generator.
 * Never references screenshotPath or local files.
 */

import { Response } from "express";
import axios from "axios";

import { asyncHandler }           from "../utils/asyncHandler";
import { AuthRequest }            from "../middleware/authMiddleware";
import { getSession, updateSessionReport } from "../database/sessionRepository";
import { ENV }                    from "../configs/env";

export const createAnalysisReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const raw       = req.params.id ?? req.params.sessionId;
  const sessionId = Array.isArray(raw) ? raw[0] : (raw as string);

  const session = await getSession(sessionId);
  if (!session)                              return res.status(404).json({ success: false, message: "Session not found" });
  if (session.userId !== req.user!.userId)   return res.status(403).json({ success: false, message: "Forbidden" });

  const sessionData = {
    session_id:         session.id,
    source_url:         session.sourceUrl      ?? undefined,
    source_filename:    session.sourceFilename ?? undefined,
    // Pass the Cloudinary URL — report generator downloads the image from it
    image_url:          (session as any).imageUrl ?? "",
    detected_patterns:  session.detectedPatternsJson  ?? [],
    scores:             session.scoresJson            ?? {},
    simulation_results: session.simulationResultsJson ?? [],
  };

  let pdfBuffer: Buffer;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const aiRes = await axios.post(
        `${ENV.AI_SERVICE_URL}/report/generate`,
        { session_id: session.id, analysis_result: sessionData },
        { responseType: "arraybuffer", timeout: 60_000 }
      );
      pdfBuffer = Buffer.from(aiRes.data);
      lastErr = null;
      break;
    } catch (err: unknown) {
      lastErr = err;
      const is502 = axios.isAxiosError(err) && err.response?.status === 502;
      if (attempt < 3) {
        const delay = is502 ? 20000 : 3000;
        console.warn(`[report] Attempt ${attempt} failed (${is502 ? '502 cold start' : 'error'}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (lastErr) {
    const message = lastErr instanceof Error ? lastErr.message : "Report generation failed";
    return res.status(500).json({ error: "REPORT_GENERATION_FAILED", message, retryable: true });
  }

  await updateSessionReport(session.id, `report-${session.id}.pdf`);

  const filename = `mirrorx-report-${session.id}.pdf`;
  res.setHeader("Content-Type",        "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length",      String(pdfBuffer.length));
  return res.send(pdfBuffer);
});
