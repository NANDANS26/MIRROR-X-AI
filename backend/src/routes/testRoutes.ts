import { Router } from "express";

import { protect, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

router.get("/protected", protect, (req: AuthRequest, res) => {
  return res.status(200).json({
    success: true,
    message: "Protected route accessed",
    user: req.user,
  });
});

export default router;