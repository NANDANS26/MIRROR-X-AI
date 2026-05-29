import { Response } from "express";

import { asyncHandler } from "../utils/asyncHandler";

import {
  AuthRequest,
} from "../middleware/authMiddleware";

import {
  getSession,
  getUserSessions,
} from "../database/sessionRepository";

export const fetchSession =
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
          message: "Session not found",
        });
      }

      return res.status(200).json({
        success: true,
        session,
      });
    }
  );

export const fetchUserSessions =
  asyncHandler(
    async (
      req: AuthRequest,
      res: Response
    ) => {
      const sessions =
        await getUserSessions(
          req.user!.userId
        );

      return res.status(200).json({
        success: true,
        sessions,
      });
    }
  );