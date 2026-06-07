import { Router } from "express";

import {
  uploadAnalysis,
  urlAnalysis,
  getHistory,
  removeSession,
} from "../controllers/analysisController";
import { upload } from "../middleware/uploadMiddleware";
import { protect } from "../middleware/authMiddleware";
import { fetchSession } from "../controllers/sessionController";

const router = Router();

// POST /api/analysis/upload — screenshot upload → pipeline
router.post(
  "/upload",
  protect,
  upload.single("file"),
  uploadAnalysis
);

// POST /api/analysis/url — URL submission → scrape → pipeline
router.post(
  "/url",
  protect,
  urlAnalysis
);

// GET /api/analysis/history — list sessions (max 100, desc)
router.get(
  "/history",
  protect,
  getHistory
);

// DELETE /api/analysis/:sessionId — delete session + file
router.delete(
  "/:sessionId",
  protect,
  removeSession
);

// GET /api/analysis/:id — fetch session by ID
router.get(
  "/:id",
  protect,
  fetchSession
);

export default router;
