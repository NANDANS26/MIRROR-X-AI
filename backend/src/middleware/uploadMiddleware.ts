/**
 * uploadMiddleware.ts — Multer upload configuration (memory storage).
 *
 * Uses memoryStorage so files are held in RAM as Buffer objects (req.file.buffer).
 * This works on Render free tier which has a read-only filesystem during runtime.
 * The buffer is sent directly to the AI service as a multipart upload.
 *
 * - MIME filter: image/jpeg, image/png, image/webp only
 * - Size limit: 10 MB
 *
 * Validates: Requirements 1.1, 1.4
 */

import multer from "multer";
import { Request } from 'express';

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${file.mimetype}. Allowed: JPEG, PNG, WebP`));
  }
};

// Memory storage — file bytes in req.file.buffer, no disk write
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
