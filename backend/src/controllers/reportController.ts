import { Response } from "express";

import { asyncHandler } from "../utils/asyncHandler";

import {
  AuthRequest,
} from "../middleware/authMiddleware";

import {
  getSession,
  updateSessionReport,
} from "../database/sessionRepository";

import {
  generateReport,
} from "../services/reportService";

export const createAnalysisReport =
  asyncHandler(
    async (
      req: AuthRequest,
      res: Response
    ) => {
      const session =
        await getSession(
          req.params.id
        );

      if (!session) {
        return res.status(404).json({
          success: false,
          message:
            "Session not found",
        });
      }

      const analysisResult = {
        detected_patterns:
          session.detectedPatternsJson,

        scores:
          session.scoresJson,

        ai_analysis:
          session.simulationResultsJson,
      };

      const report =
        await generateReport(
          session.id,
          analysisResult
        );

      await updateSessionReport(
        session.id,
        report.file_path
      );

      return res.status(200).json({
        success: true,

        reportPath:
          report.file_path,
      });
    }
  );