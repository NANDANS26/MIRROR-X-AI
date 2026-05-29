import { Router } from "express";

import { uploadAnalysis } from "../controllers/analysisController";

import { upload } from "../middleware/uploadMiddleware";
import { protect } from "../middleware/authMiddleware";
import {
  fetchSession,
  fetchUserSessions,
} from "../controllers/sessionController";

const router = Router();

router.post(
  "/upload",
  protect,
  upload.single("file"),
  uploadAnalysis
);

router.get(
  "/history",
  protect,
  fetchUserSessions
);

router.get(
  "/:id",
  protect,
  fetchSession
);

export default router;