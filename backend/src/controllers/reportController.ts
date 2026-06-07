/**
 * reportController.ts
 *
 * Generates PDF report via AI service.
 * Passes imageUrl (Cloudinary) so report can embed the screenshot.
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

  // Cast to any to access imageUrl — Prisma type was regenerated after schema change
  const s = session as any;

  const sessionData = {
    session_id:         s.id,
    source_url:         s.sourceUrl         ?? undefined,
    source_filename:    s.sourceFilename    ?? undefined,
    image_url:          s.imageUrl          ?? "",
    detected_patterns:  s.detectedPatternsJson  ?? [],
    scores:             s.scoresJson             ?? {},
    simulation_results: s.simulationResultsJson  ?? [],
  };

  // Try up to 3 times — AI service may be cold-starting (502)
  let pdfData: ArrayBuffer | null = null;
  let lastErr: string = "Report generation failed";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[report] Attempt ${attempt} — calling AI service /report/generate for session ${sessionId}`);
      const aiRes = await axios.post(
        `${ENV.AI_SERVICE_URL}/report/generate`,
        { session_id: s.id, analysis_result: sessionData },
        { responseType: "arraybuffer", timeout: 90_000 }
      );
      pdfData = aiRes.data;
      console.log(`[report] Success on attempt ${attempt}. PDF size: ${(aiRes.data as ArrayBuffer).byteLength} bytes`);
      break;
    } catch (err: unknown) {
      const is502 = axios.isAxiosError(err) && err.response?.status === 502;
      const errMsg = err instanceof Error ? err.message : String(err);
      lastErr = errMsg;
      console.warn(`[report] Attempt ${attempt} failed. is502=${is502} error=${errMsg}`);
      if (attempt < 3) {
        const delay = is502 ? 20_000 : 4_000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (!pdfData) {
    console.error(`[report] All 3 attempts failed. Last error: ${lastErr}`);
    return res.status(500).json({ error: "REPORT_GENERATION_FAILED", message: lastErr, retryable: true });
  }

  const pdfBuffer = Buffer.from(pdfData);

  await updateSessionReport(s.id, `report-${s.id}.pdf`);

  const filename = `mirrorx-report-${s.id}.pdf`;
  res.setHeader("Content-Type",        "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length",      String(pdfBuffer.length));
  return res.send(pdfBuffer);
});
