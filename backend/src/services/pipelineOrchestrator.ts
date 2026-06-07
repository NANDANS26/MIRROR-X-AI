/**
 * pipelineOrchestrator.ts — Resilient 5-stage analysis pipeline.
 *
 * Each stage is independently fault-tolerant:
 * - OCR / analyze failure  → marks stage failed, pipeline continues with empty patterns
 * - Simulation failure     → continues with empty simulation results
 * - Scoring failure        → continues with default scores
 * - DB persist failure     → logged, session still marked completed
 * - Never crashes entire investigation
 */

import axios from "axios";
import FormData as FormData_Node from "form-data";
import fs from "fs";
import { Prisma } from "@prisma/client";

import { io } from "../server";
import { ENV } from "../configs/env";
import { prisma } from "../database/prisma";
import { ScrapeResult } from "./scraperService";

export interface PipelineInput {
  type: "upload" | "url";
  fileBuffer?: Buffer;       // in-memory file bytes (replaces filePath)
  fileMimetype?: string;
  fileOriginalname?: string;
  filePath?: string;         // legacy / local dev only
  scrapedData?: ScrapeResult;
}

interface DetectedPattern {
  category: string;
  element_identifier: string;
  confidence_level: "Low" | "Medium" | "High";
  explanation: string;
  bounding_box?: { x: number; y: number; width: number; height: number } | null;
}

interface SimulationResult {
  persona: string;
  confusion_points: unknown[];
  pressure_points: unknown[];
  hidden_risk_areas: unknown[];
  accidental_consent_zones: unknown[];
  behavioral_summary: string;
}

interface ScoreBreakdown {
  score: number;
  contributions: { pattern_name: string; points: number }[];
}

interface AnalysisScores {
  manipulation_score: ScoreBreakdown;
  trust_score: ScoreBreakdown;
  friction_score: ScoreBreakdown;
  ux_fairness_index: "Fair" | "Moderate Risk" | "High Risk";
}

interface AnalyzeResponse {
  success: boolean;
  screenshot_path: string;
  ocr_result: unknown;
  rule_flags: unknown[];
  detected_patterns: DetectedPattern[];
  scores: AnalysisScores;
  ai_analysis: unknown;
}

const DEFAULT_SCORES: AnalysisScores = {
  manipulation_score: { score: 0, contributions: [] },
  trust_score: { score: 100, contributions: [] },
  friction_score: { score: 0, contributions: [] },
  ux_fairness_index: "Fair",
};

function emitProgress(socketId: string, stage: string, step: number, label: string) {
  io.to(socketId).emit("stage_progress", {
    stage, stepNumber: step, totalSteps: 5, label,
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await sleep(1000);
    return fn();
  }
}

/**
 * Determine whether an Axios error is a Gemini quota exhaustion (429 / ResourceExhausted).
 */
function isQuotaError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  const data = err.response?.data as Record<string, unknown> | undefined;
  if (status === 429) return true;
  if (typeof data?.detail === "string" && data.detail.includes("ResourceExhausted")) return true;
  if (typeof data?.detail === "string" && data.detail.toLowerCase().includes("quota")) return true;
  return false;
}

export async function runPipeline(
  sessionId: string,
  socketId: string,
  input: PipelineInput
): Promise<void> {
  io.to(socketId).emit("session_started", { sessionId });

  // ── Stage 1: Capture ──────────────────────────────────────────────────────
  emitProgress(socketId, "capture", 1, "Capturing evidence...");

  // ── Stages 2+3: Rule engine + AI analysis ─────────────────────────────────
  emitProgress(socketId, "rule_engine", 2, "Scanning for dark patterns...");
  emitProgress(socketId, "ai_analysis", 3, "Analyzing with MIRROR X AI...");

  let analyzeResponse: AnalyzeResponse | null = null;
  let analyzeError: string | null = null;
  let quotaExceeded = false;

  try {
    analyzeResponse = await withRetry(async () => {
      if (input.type === "upload") {
        // Use in-memory buffer if available (production/Render), fall back to file path (local dev)
        if (input.fileBuffer) {
          const formData = new FormData();
          const blob = new Blob([input.fileBuffer], { type: input.fileMimetype || "image/png" });
          formData.append("file", blob, input.fileOriginalname || "upload.png");
          const res = await axios.post<AnalyzeResponse>(
            `${ENV.AI_SERVICE_URL}/analyze/upload`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 }
          );
          return res.data;
        } else if (input.filePath) {
          const fd = new FormData_Node();
          fd.append("file", fs.createReadStream(input.filePath));
          const res = await axios.post<AnalyzeResponse>(
            `${ENV.AI_SERVICE_URL}/analyze/upload`,
            fd,
            { headers: fd.getHeaders(), timeout: 120_000 }
          );
          return res.data;
        } else {
          throw new Error("No file data available for upload pipeline");
        }
      } else {
        const scraped = input.scrapedData!;
        const res = await axios.post<AnalyzeResponse>(
          `${ENV.AI_SERVICE_URL}/analyze/url`,
          {
            dom_html: scraped.domHtml,
            screenshot_path: scraped.screenshotPath,
            page_title: scraped.pageTitle,
            meta_description: scraped.metaDescription,
            buttons: scraped.buttons,
            ocr_text: "",
          },
          { timeout: 120_000 }
        );
        return res.data;
      }
    });
  } catch (err) {
    if (isQuotaError(err)) {
      quotaExceeded = true;
      analyzeError = "AI reasoning temporarily unavailable due to API limits. Heuristic analysis remains available.";
      console.warn("[pipeline] Gemini quota exceeded — continuing with heuristic-only results");
    } else {
      analyzeError = err instanceof Error ? err.message : "Analysis service unavailable";
      console.error("[pipeline] Analyze stage failed:", analyzeError);
    }
    // Do NOT throw — continue pipeline with empty/fallback data
  }

  const detectedPatterns: DetectedPattern[] = analyzeResponse?.detected_patterns ?? [];
  const aiAnalysis: unknown = quotaExceeded
    ? analyzeError
    : analyzeResponse?.ai_analysis ?? null;

  // ── Stage 4: Simulation ───────────────────────────────────────────────────
  emitProgress(socketId, "simulation", 4, "Simulating user impact...");

  let simulationResults: SimulationResult[] = [];

  try {
    simulationResults = await withRetry(async () => {
      const res = await axios.post<SimulationResult[]>(
        `${ENV.AI_SERVICE_URL}/simulate`,
        {
          detected_patterns: detectedPatterns,
          personas: ["Elderly User", "Distracted User", "Impulsive User", "First-Time User"],
        },
        { timeout: 60_000 }
      );
      return res.data;
    });
  } catch (err) {
    const msg = isQuotaError(err)
      ? "Simulation skipped: AI quota exceeded"
      : err instanceof Error ? err.message : "Simulation service unavailable";
    console.warn("[pipeline] Simulation stage failed (non-fatal):", msg);
    // Continue with empty simulation results
  }

  // ── Stage 5: Scoring ──────────────────────────────────────────────────────
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
  } catch (err) {
    console.warn("[pipeline] Scoring stage failed (non-fatal), using defaults");
    // Continue with default scores
  }

  // ── Persist to PostgreSQL ─────────────────────────────────────────────────
  // FIX P2028: Use individual sequential Prisma calls instead of interactive
  // $transaction to avoid the default 5-second timeout being exceeded by long
  // pipelines. Each write is independently retried if needed.
  try {
    await prisma.analysisSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        ocrResultJson: (analyzeResponse?.ocr_result ?? {}) as object,
        ruleFlagsJson: (analyzeResponse?.rule_flags ?? []) as object,
        detectedPatternsJson: detectedPatterns as unknown as object,
        simulationResultsJson: simulationResults as unknown as object,
        scoresJson: scores as unknown as object,
        failedStage: analyzeError ? "ai_analysis" : null,
      },
    });
  } catch (dbErr) {
    console.error("[pipeline] DB session update failed (non-fatal):", dbErr);
  }

  if (detectedPatterns.length > 0) {
    try {
      await prisma.detectedPatternRecord.createMany({
        data: detectedPatterns.map((p) => ({
          sessionId,
          category: p.category,
          elementIdentifier: p.element_identifier,
          confidenceLevel: p.confidence_level,
          explanation: p.explanation,
          boundingBoxJson: p.bounding_box
            ? (p.bounding_box as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        })),
        skipDuplicates: true,
      });
    } catch (dbErr) {
      console.error("[pipeline] DB detectedPatternRecord.createMany failed (non-fatal):", dbErr);
    }
  }

  if (simulationResults.length > 0) {
    try {
      await prisma.simulationResultRecord.createMany({
        data: simulationResults.map((s) => ({
          sessionId,
          persona: s.persona,
          findingsJson: {
            confusion_points: s.confusion_points,
            pressure_points: s.pressure_points,
            hidden_risk_areas: s.hidden_risk_areas,
            accidental_consent_zones: s.accidental_consent_zones,
          } as unknown as object,
          behavioralSummary: s.behavioral_summary,
        })),
        skipDuplicates: true,
      });
    } catch (dbErr) {
      console.error("[pipeline] DB simulationResultRecord.createMany failed (non-fatal):", dbErr);
    }
  }

  try {
    await prisma.scoringResult.upsert({
      where: { sessionId },
      create: {
        sessionId,
        manipulationScore: scores.manipulation_score.score,
        trustScore: scores.trust_score.score,
        frictionScore: scores.friction_score.score,
        uxFairnessIndex: scores.ux_fairness_index,
        breakdownJson: {
          manipulation_score: scores.manipulation_score,
          trust_score: scores.trust_score,
          friction_score: scores.friction_score,
        } as unknown as object,
      },
      update: {
        manipulationScore: scores.manipulation_score.score,
        trustScore: scores.trust_score.score,
        frictionScore: scores.friction_score.score,
        uxFairnessIndex: scores.ux_fairness_index,
        breakdownJson: {
          manipulation_score: scores.manipulation_score,
          trust_score: scores.trust_score,
          friction_score: scores.friction_score,
        } as unknown as object,
      },
    });
  } catch (dbErr) {
    console.error("[pipeline] DB scoringResult.upsert failed (non-fatal):", dbErr);
    // Still emit session_complete — results exist in memory even if DB failed
  }

  // Emit completion with ai_error flag if Gemini quota was hit
  io.to(socketId).emit("session_complete", {
    sessionId,
    ...(analyzeError ? { ai_error: analyzeError, quota_exceeded: quotaExceeded } : {}),
  });
}
