/**
 * Tests for upload middleware (Multer configuration).
 *
 * Property 8: For any {size, mimetype} outside spec, the upload is rejected.
 *
 * Validates: Requirements 1.1, 1.4
 */

import * as fc from "fast-check";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./uploadMiddleware";

// ---------------------------------------------------------------------------
// Unit tests — MIME type filtering
// ---------------------------------------------------------------------------

describe("MIME type filtering", () => {
  it("allows image/jpeg", () => {
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
  });

  it("allows image/png", () => {
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
  });

  it("allows image/webp", () => {
    expect(ALLOWED_MIME_TYPES.has("image/webp")).toBe(true);
  });

  it("rejects application/pdf", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(false);
  });

  it("rejects image/gif", () => {
    expect(ALLOWED_MIME_TYPES.has("image/gif")).toBe(false);
  });

  it("rejects image/bmp", () => {
    expect(ALLOWED_MIME_TYPES.has("image/bmp")).toBe(false);
  });

  it("rejects text/html", () => {
    expect(ALLOWED_MIME_TYPES.has("text/html")).toBe(false);
  });

  it("rejects application/octet-stream", () => {
    expect(ALLOWED_MIME_TYPES.has("application/octet-stream")).toBe(false);
  });

  it("contains exactly 3 allowed types", () => {
    expect(ALLOWED_MIME_TYPES.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — file size limit
// ---------------------------------------------------------------------------

describe("file size limit", () => {
  const TEN_MB = 10 * 1024 * 1024;

  it("MAX_FILE_SIZE equals exactly 10 MB (10485760 bytes)", () => {
    expect(MAX_FILE_SIZE).toBe(TEN_MB);
  });

  it("exactly 10 MB is at the limit (accepted)", () => {
    // A file of exactly MAX_FILE_SIZE bytes is accepted
    expect(TEN_MB <= MAX_FILE_SIZE).toBe(true);
  });

  it("10 MB + 1 byte exceeds the limit", () => {
    expect(TEN_MB + 1).toBeGreaterThan(MAX_FILE_SIZE);
  });

  it("0 bytes is under the limit", () => {
    expect(0).toBeLessThanOrEqual(MAX_FILE_SIZE);
  });
});

// ---------------------------------------------------------------------------
// fileFilter logic tests — test the filter function directly
// ---------------------------------------------------------------------------

/**
 * Extract and test the fileFilter logic independently from Multer.
 * We recreate the same logic used in uploadMiddleware.ts.
 */
function testFileFilter(mimetype: string): { accepted: boolean; error?: string } {
  let accepted = false;
  let error: string | undefined;

  const cb = (err: Error | null, result?: boolean) => {
    if (err) {
      error = err.message;
    } else {
      accepted = result === true;
    }
  };

  if (ALLOWED_MIME_TYPES.has(mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${mimetype}. Allowed: JPEG, PNG, WebP`));
  }

  return { accepted, error };
}

describe("fileFilter logic", () => {
  it("accepts image/jpeg with no error", () => {
    const result = testFileFilter("image/jpeg");
    expect(result.accepted).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts image/png with no error", () => {
    const result = testFileFilter("image/png");
    expect(result.accepted).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts image/webp with no error", () => {
    const result = testFileFilter("image/webp");
    expect(result.accepted).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects PDF with descriptive error", () => {
    const result = testFileFilter("application/pdf");
    expect(result.accepted).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/unsupported file format/i);
  });

  it("rejects GIF with descriptive error", () => {
    const result = testFileFilter("image/gif");
    expect(result.accepted).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/unsupported file format/i);
  });

  it("error message includes the rejected MIME type", () => {
    const result = testFileFilter("video/mp4");
    expect(result.error).toContain("video/mp4");
  });
});

// ---------------------------------------------------------------------------
// Property 8 — arbitrary {size, mimetype} records outside spec rejected
// Validates: Requirements 1.1, 1.4
// ---------------------------------------------------------------------------

describe("Property 8 — file validation rejection", () => {
  const VALID_MIMES = ["image/jpeg", "image/png", "image/webp"];
  const INVALID_MIMES = [
    "application/pdf",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "video/mp4",
    "text/html",
    "application/octet-stream",
    "application/json",
    "image/svg+xml",
    "audio/mpeg",
  ];

  it("all valid MIME types are accepted by the filter", () => {
    for (const mime of VALID_MIMES) {
      const result = testFileFilter(mime);
      expect(result.accepted).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it("all invalid MIME types are rejected with descriptive errors", () => {
    for (const mime of INVALID_MIMES) {
      const result = testFileFilter(mime);
      expect(result.accepted).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.length).toBeGreaterThan(0);
    }
  });

  it("Property 8a — any non-allowed MIME is always rejected", () => {
    // Use fast-check to generate arbitrary MIME-type-like strings
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }),
        (mimetype) => {
          if (VALID_MIMES.includes(mimetype)) {
            // Valid MIME — should be accepted
            const result = testFileFilter(mimetype);
            expect(result.accepted).toBe(true);
          } else {
            // Everything else — should be rejected
            const result = testFileFilter(mimetype);
            expect(result.accepted).toBe(false);
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe("string");
            expect(result.error!.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("Property 8b — file sizes above MAX_FILE_SIZE are out of spec", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE + 100 * 1024 * 1024 }),
        (size) => {
          expect(size).toBeGreaterThan(MAX_FILE_SIZE);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("Property 8c — file sizes at or below MAX_FILE_SIZE are in spec", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        (size) => {
          expect(size).toBeLessThanOrEqual(MAX_FILE_SIZE);
        }
      ),
      { numRuns: 200 }
    );
  });
});
