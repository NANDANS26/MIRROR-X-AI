/**
 * chatController.ts — Conversational AI chat endpoint handler.
 *
 * POST /api/chat/:sessionId — Send a message, get AI response, persist both.
 *
 * Error policy:
 *   - The AI service always returns HTTP 200 with { success, error_type, response }.
 *   - If the AI service is unreachable (network/timeout), we return a structured
 *     fallback response — never a generic 500.
 *   - Frontend reads error_type to display specific, actionable messages.
 *
 * Validates: Requirements 7.1-7.9, 16.1-16.4
 */

import { Response } from "express";
import axios from "axios";

import { asyncHandler } from "../utils/asyncHandler";
import { AuthRequest } from "../middleware/authMiddleware";
import { prisma } from "../database/prisma";
import { getSession } from "../database/sessionRepository";
import { ENV } from "../configs/env";

// Human-readable messages for each error type
const ERROR_MESSAGES: Record<string, string> = {
  authentication:
    "The AI explanation service is temporarily unavailable due to an authentication issue. " +
    "Your investigation results remain fully available. AI commentary will resume once the service is restored.",
  quota:
    "AI reasoning is temporarily unavailable — the API usage limit has been reached. " +
    "Your investigation results are intact. AI commentary will resume automatically once the quota resets.",
  rate_limit:
    "The AI service is receiving too many requests right now. " +
    "Your investigation results are intact. Please try again in a few seconds.",
  timeout:
    "The AI explanation request timed out. Your investigation results are intact. Please try again.",
  network:
    "Could not reach the AI explanation service. " +
    "Your investigation results are intact. Please check connectivity and try again.",
  unknown:
    "The AI explanation service encountered an unexpected error. " +
    "Your investigation results are intact. Please try again shortly.",
};

function getFallbackMessage(errorType?: string): string {
  return ERROR_MESSAGES[errorType ?? "unknown"] ?? ERROR_MESSAGES.unknown;
}

export const chatWithAI = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const rawId = req.params.id ?? req.params.sessionId
    const sessionId = Array.isArray(rawId) ? rawId[0] : (rawId as string)
    const { message } = req.body as { message: string };

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }
    if (session.userId !== req.user!.userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Load last 10 ChatMessage records for this session
    const recentMessages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
      take: 10,
    });

    const history = recentMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const minimalContext: Record<string, unknown> = {
      source_type: session.sourceType,
      source_url_or_filename: session.sourceUrl || session.sourceFilename || "",
      detected_patterns: session.detectedPatternsJson ?? [],
      scores: session.scoresJson ?? {},
    };

    // ── Call AI Service ────────────────────────────────────────────────────────
    let aiSuccess = true;
    let aiResponse = "";
    let aiErrorType: string | null = null;

    try {
      const aiRes = await axios.post(
        `${ENV.AI_SERVICE_URL}/chat/explain`,
        { session_context: minimalContext, history, user_message: message },
        { timeout: 60_000 }
      );

      // AI service always returns 200 — check the payload for Gemini-level errors
      aiSuccess = aiRes.data?.success !== false;
      aiResponse = aiRes.data?.response ?? "";
      aiErrorType = aiRes.data?.error_type ?? null;

      if (!aiSuccess) {
        console.warn(
          `[chatController] Gemini fallback activated. error_type=${aiErrorType}`
        );
        aiResponse = aiRes.data?.fallback_answer || getFallbackMessage(aiErrorType ?? undefined);
      }
    } catch (networkErr) {
      // AI service is unreachable (network error, timeout, process down)
      aiSuccess = false;
      aiErrorType = axios.isAxiosError(networkErr)
        ? networkErr.code === "ECONNABORTED" ? "timeout" : "network"
        : "network";
      aiResponse = getFallbackMessage(aiErrorType);
      console.error(
        `[chatController] AI service unreachable. error_type=${aiErrorType}`,
        networkErr instanceof Error ? networkErr.message : networkErr
      );
    }

    // ── Persist both messages (even fallback responses, for history continuity)
    try {
      await prisma.chatMessage.createMany({
        data: [
          { sessionId, userId: req.user!.userId, role: "user", content: message },
          { sessionId, userId: req.user!.userId, role: "assistant", content: aiResponse },
        ],
      });
    } catch (dbErr) {
      console.error("[chatController] Failed to persist chat messages (non-fatal):", dbErr);
    }

    // Always HTTP 200 — structured payload tells frontend exactly what happened
    return res.status(200).json({
      success: aiSuccess,
      response: aiResponse,
      error_type: aiErrorType,
      // Include fallback info for frontend to show specific error UI
      ...(aiSuccess ? {} : {
        ai_unavailable: true,
        fallback_reason: aiErrorType,
        fallback_message: getFallbackMessage(aiErrorType ?? undefined),
      }),
    });
  }
);
