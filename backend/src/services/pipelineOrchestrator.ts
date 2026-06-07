/**
 * pipelineOrchestrator.ts — Resilient 5-stage analysis pipeline.
 *
 * imageUrl is now the persistent Cloudinary URL stored in AnalysisSession.
 * fileBuffer is passed only to the AI service for OCR — it is never written to disk.
 */

import axios          from "axios";
import FormData_Node  from "form-data";
import { Prisma }     from "@prisma/client";

import { io }       from "../server";
import { ENV }      from "../configs/env";
import { prisma }   from "../database/prisma";
import { ScrapeResult } from "./scraperService";

export interface PipelineInput {
  type:             "upload" | "url";
  fileBuffer?:      Buffer;
  fileMimetype?:    string;
  fileOriginalname?: string;
  imageUrl?:        string;   // Cloudinary secure_url for upload sessions
  scrapedData?:     ScrapeResult;
}

interface DetectedPattern {
  category:           string;
  element_identifier: string;
  confidence_level:   "Low" | "Medium" | "High";
  explanation:        string;
  bounding_box?:      { x: number; y: number; width: number; height: number } | null;
}
interface SimulationResult {
  persona:                  string;
  confusion_points:         unknown[];
  pressure_points:          unknown[];
  hidden_risk_areas:        unknown[];
  accidental_consent_zones: unknown[];
  behavioral_summary:       string;
}
interface ScoreBreakdown {
  score:         number;
  contributions: { pattern_name: string; points: number }[];
}
interface AnalysisScores {
  manipulation_score: ScoreBreakdown;
  trust_score:        ScoreBreakdown;
  friction_score:     ScoreBreakdown;
  ux_fairness_index:  "Fair" | "Moderate Risk" | "High Risk";
}
interface AnalyzeResponse {
  success:           boolean;
  ocr_result:        unknown;
  rule_flags:        unknown[];
  detected_patterns: DetectedPattern[];
  scores:            AnalysisScores;
  ai_analysis:       unknown;
}

const DEFAULT_SCORES: AnalysisScores = {
  manipulation_score: { score: 0,   contributions: [] },
  trust_score:        { score: 100, contributions: [] },
  friction_score:     { score: 0,   contributions: [] },
  ux_fairness_index:  "Fair",
};

function emitProgress(socketId: string, stage: string, step: number, label: string) {
  io.to(socketId).emit("stage_progress", { stage, stepNumber: step, totalSteps: 5, label });
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts) {
        // Longer delay on 502 (cold start) — AI service needs time to wake up
        const is502 = axios.isAxiosError(err) && err.response?.status === 502
        const delay = is502 ? 15000 : 2000 * attempt
        console.warn(`[pipeline] Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  throw lastErr
}
function isQuotaError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const s = err.response?.status;
  const d = err.response?.data as Record<string, unknown> | undefined;
  if (s === 429) return true;
  if (typeof d?.detail === "string" && (d.detail.includes("ResourceExhausted") || d.detail.toLowerCase().includes("quota"))) return true;
  return false;
}

export async function runPipeline(sessionId: string, socketId: string, input: PipelineInput): Promise<void> {
  io.to(socketId).emit("session_started", { sessionId });

  emitProgress(socketId, "capture",     1, "Capturing evidence...");
  emitProgress(socketId, "rule_engine", 2, "Scanning for dark patterns...");
  emitProgress(socketId, "ai_analysis", 3, "Analyzing with MIRROR X AI...");

  let analyzeResponse: AnalyzeResponse | null = null;
  let analyzeError: string | null = null;
  let quotaExceeded = false;

  try {
    analyzeResponse = await withRetry(async () => {
      if (input.type === "upload") {
        if (!input.fileBuffer) throw new Error("No file buffer for upload pipeline");

        // Send the raw bytes to the AI service as multipart — Buffer is safe here
        const fd = new FormData_Node();
        fd.append("file", input.fileBuffer, {
          filename:    input.fileOriginalname || "upload.png",
          contentType: input.fileMimetype     || "image/png",
        });
        const res = await axios.post<AnalyzeResponse>(
          `${ENV.AI_SERVICE_URL}/analyze/upload`,
          fd,
          { headers: fd.getHeaders(), timeout: 120_000 }
        );
        return res.data;
      } else {
        const scraped = input.scrapedData!;
        const res = await axios.post<AnalyzeResponse>(
          `${ENV.AI_SERVICE_URL}/analyze/url`,
          {
            dom_html:         scraped.domHtml,
            screenshot_path:  "",
            page_title:       scraped.pageTitle,
            meta_description: scraped.metaDescription,
            buttons:          scraped.buttons,
            ocr_text:         "",
          },
          { timeout: 120_000 }
        );
        return res.data;
      }
    });
  } catch (err) {
    if (isQuotaError(err)) {
      quotaExceeded = true;
      analyzeError  = "AI reasoning temporarily unavailable due to API limits.";
      console.warn("[pipeline] Gemini quota exceeded");
    } else {
      analyzeError = err instanceof Error ? err.message : "Analysis service unavailable";
      console.error("[pipeline] Analyze stage failed:", analyzeError);
    }
  }

  const detectedPatterns: DetectedPattern[] = analyzeResponse?.detected_patterns ?? [];

  emitProgress(socketId, "simulation", 4, "Simulating user impact...");
  let simulationResults: SimulationResult[] = [];
  try {
    simulationResults = await withRetry(async () => {
      const res = await axios.post<SimulationResult[]>(
        `${ENV.AI_SERVICE_URL}/simulate`,
        { detected_patterns: detectedPatterns, personas: ["Elderly User","Distracted User","Impulsive User","First-Time User"] },
        { timeout: 60_000 }
      );
      return res.data;
    });
  } catch (err) {
    console.warn("[pipeline] Simulation stage failed (non-fatal):", isQuotaError(err) ? "quota" : err);
  }

  emitProgress(socketId, "scoring", 5, "Computing risk scores...");
  let scores: AnalysisScores = DEFAULT_SCORES;
  try {
    scores = await withRetry(async () => {
      const res = await axios.post<AnalysisScores>(
        `${ENV.AI_SERVICE_URL}/score`,
        { detected_patterns: detectedPatterns },
        { timeout: 30_000 }
      );
      return res.data;
    });
  } catch { console.warn("[pipeline] Scoring stage failed (non-fatal), using defaults"); }

  // ── Persist ───────────────────────────────────────────────────────────────
  try {
    await prisma.analysisSession.update({
      where: { id: sessionId },
      data: {
        status:               "completed",
        ocrResultJson:        (analyzeResponse?.ocr_result   ?? {}) as object,
        ruleFlagsJson:        (analyzeResponse?.rule_flags    ?? []) as object,
        detectedPatternsJson: detectedPatterns                       as unknown as object,
        simulationResultsJson: simulationResults                     as unknown as object,
        scoresJson:           scores                                  as unknown as object,
        failedStage:          analyzeError ? "ai_analysis" : null,
      },
    });
  } catch (e) { console.error("[pipeline] DB session update failed:", e); }

  if (detectedPatterns.length > 0) {
    try {
      await prisma.detectedPatternRecord.createMany({
        data: detectedPatterns.map(p => ({
          sessionId,
          category:          p.category,
          elementIdentifier: p.element_identifier,
          confidenceLevel:   p.confidence_level,
          explanation:       p.explanation,
          boundingBoxJson:   p.bounding_box ? (p.bounding_box as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        })),
        skipDuplicates: true,
      });
    } catch (e) { console.error("[pipeline] detectedPatternRecord.createMany failed:", e); }
  }

  if (simulationResults.length > 0) {
    try {
      await prisma.simulationResultRecord.createMany({
        data: simulationResults.map(s => ({
          sessionId,
          persona:          s.persona,
          findingsJson:     { confusion_points: s.confusion_points, pressure_points: s.pressure_points, hidden_risk_areas: s.hidden_risk_areas, accidental_consent_zones: s.accidental_consent_zones } as unknown as object,
          behavioralSummary: s.behavioral_summary,
        })),
        skipDuplicates: true,
      });
    } catch (e) { console.error("[pipeline] simulationResultRecord.createMany failed:", e); }
  }

  try {
    await prisma.scoringResult.upsert({
      where:  { sessionId },
      create: { sessionId, manipulationScore: scores.manipulation_score.score, trustScore: scores.trust_score.score, frictionScore: scores.friction_score.score, uxFairnessIndex: scores.ux_fairness_index, breakdownJson: { manipulation_score: scores.manipulation_score, trust_score: scores.trust_score, friction_score: scores.friction_score } as unknown as object },
      update: {                manipulationScore: scores.manipulation_score.score, trustScore: scores.trust_score.score, frictionScore: scores.friction_score.score, uxFairnessIndex: scores.ux_fairness_index, breakdownJson: { manipulation_score: scores.manipulation_score, trust_score: scores.trust_score, friction_score: scores.friction_score } as unknown as object },
    });
  } catch (e) { console.error("[pipeline] scoringResult.upsert failed:", e); }

  io.to(socketId).emit("session_complete", {
    sessionId,
    ...(analyzeError ? { ai_error: analyzeError, quota_exceeded: quotaExceeded } : {}),
  });
}
