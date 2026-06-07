import { Router } from "express";
import { prisma } from "../database/prisma";
import { Request, Response } from 'express';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
});
// Basic health
router.get("/", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "MIRROR X AI Backend Healthy",
  });
});

// Database availability check — frontend polls this to show DB error state
router.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ success: true, database: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    return res.status(503).json({
      success: false,
      database: "unavailable",
      error: message,
      hint: "Ensure PostgreSQL is running at localhost:5432 and DATABASE_URL is correct.",
    });
  }
});

export default router;
