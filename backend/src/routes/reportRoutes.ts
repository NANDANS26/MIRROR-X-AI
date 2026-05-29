import { Router } from "express";

import {
  protect,
} from "../middleware/authMiddleware";

import {
  createAnalysisReport,
} from "../controllers/reportController";

const router = Router();

router.post(
  "/:id",
  protect,
  createAnalysisReport
);

export default router;