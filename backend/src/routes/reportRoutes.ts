import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import { createAnalysisReport } from "../controllers/reportController";

const router = Router();

// GET /api/report/:sessionId — generate and stream PDF report
router.get("/:sessionId", protect, createAnalysisReport);

// Keep POST for legacy compatibility
router.post("/:id", protect, createAnalysisReport);

export default router;
