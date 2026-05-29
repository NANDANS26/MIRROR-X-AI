import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "MIRROR X AI Backend Healthy",
  });
});

export default router;