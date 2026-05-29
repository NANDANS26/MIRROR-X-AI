import { Response } from "express";

import { asyncHandler } from "../utils/asyncHandler";

import { analyzeScreenshot } from "../services/aiService";

import {
  AuthRequest,
} from "../middleware/authMiddleware";

import {
  createSession,
} from "../database/sessionRepository";

export const uploadAnalysis =
  asyncHandler(
    async (
      req: AuthRequest,
      res: Response
    ) => {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const analysisResult =
        await analyzeScreenshot(
          req.file.path
        );

      const session =
        await createSession({
          userId:
            req.user!.userId,

          expiresAt:
            new Date(
              Date.now() +
              30 *
              24 *
              60 *
              60 *
              1000
            ),

          sourceType: "upload",

          sourceFilename:
            req.file.filename,

          screenshotPath:
            req.file.path,

          status: "complete",

          ocrResultJson:
            analysisResult
              .ocr_result,

          ruleFlagsJson:
            analysisResult
              .rule_flags,

          detectedPatternsJson:
            analysisResult
              .detected_patterns,
          
          scoresJson:
            analysisResult.scores,
        });

      return res.status(200).json({
        success: true,

        sessionId: session.id,

        analysis: analysisResult,
      });
    }
  );