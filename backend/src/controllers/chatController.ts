import { Response } from "express";

import { asyncHandler } from "../utils/asyncHandler";

import {
  AuthRequest,
} from "../middleware/authMiddleware";

import {
  getSession,
} from "../database/sessionRepository";

import {
  askAI,
} from "../services/chatService";

export const chatWithAI =
  asyncHandler(
    async (
      req: AuthRequest,
      res: Response
    ) => {
      const { message } =
        req.body;

      const session =
        await getSession(
          req.params.id
        );

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }

      const aiResponse =
        await askAI(
          session,
          message
        );

      return res.status(200).json({
        success: true,
        response:
          aiResponse.response,
      });
    }
  );