import { Router } from "express";

import {
  chatWithAI,
} from "../controllers/chatController";

import {
  protect,
} from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/:id",
  protect,
  chatWithAI
);

export default router;