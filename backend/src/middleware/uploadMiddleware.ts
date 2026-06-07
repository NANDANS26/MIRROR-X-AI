/**
 * uploadMiddleware.ts — Multer upload configuration.
 *
 * - Destination: `uploads/` (relative to project root)
 * - Filename: UUID-based (no race conditions)
 * - MIME filter: image/jpeg, image/png, image/webp only
 * - Size limit: 10 MB
 *
 * Validates: Requirements 1.1, 1.4
 */

import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import { Request } from 'express';

const UPLOAD_DIR = "uploads";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${file.mimetype}. Allowed: JPEG, PNG, WebP`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, UPLOAD_DIR };
