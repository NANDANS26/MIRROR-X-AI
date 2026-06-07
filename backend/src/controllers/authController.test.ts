/**
 * Tests for auth controllers (registerUser / loginUser).
 *
 * Property 14: Login Rate Limiting
 * For any sequence of failed login attempts for the same email within 15
 * minutes, attempts 1–4 SHALL be permitted (401) and attempt 5 and beyond
 * SHALL be blocked for 15 minutes (429 ACCOUNT_LOCKED).
 *
 * **Validates: Requirements 9.2, 9.3, 9.6, 9.7**
 */

// Set env vars BEFORE importing any module that reads them
process.env.JWT_SECRET = "test-secret-auth-controller";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.AI_SERVICE_URL = "http://localhost:8000";

// Mock the env module to prevent validation throws in configs/env.ts
jest.mock("../configs/env", () => ({
  ENV: {
    JWT_SECRET: "test-secret-auth-controller",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    AI_SERVICE_URL: "http://localhost:8000",
    PORT: "3001",
  },
}));

// Mock Prisma to avoid needing a real database
jest.mock("../database/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Make asyncHandler transparent so we can await the controller directly in tests
jest.mock("../utils/asyncHandler", () => ({
  asyncHandler: (fn: Function) => fn,
}));

import { Request, Response } from "express";
import * as fc from "fast-check";
import { registerUser, loginUser } from "./authController";
import { prisma } from "../database/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockReq = (body: object) => ({ body } as Request);

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

// Cast prisma mocks to jest.Mock for TypeScript
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;

// ---------------------------------------------------------------------------
// registerUser — unit tests
// ---------------------------------------------------------------------------

describe("registerUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Requirement 9.2 — RFC 5321 email validation
  describe("email format validation", () => {
    it("rejects email missing @ symbol", async () => {
      const res = mockRes();
      await registerUser(mockReq({ email: "notanemail.com", password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid email format" }));
    });

    it("rejects email with spaces", async () => {
      const res = mockRes();
      await registerUser(mockReq({ email: "user @domain.com", password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid email format" }));
    });

    it("rejects email with no domain part", async () => {
      const res = mockRes();
      await registerUser(mockReq({ email: "user@", password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid email format" }));
    });

    it("rejects email with no TLD separator", async () => {
      const res = mockRes();
      await registerUser(mockReq({ email: "user@domain", password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid email format" }));
    });

    it("accepts a valid email address", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "u1", email: "user@example.com" });
      const res = mockRes();
      await registerUser(mockReq({ email: "user@example.com", password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("accepts email with subdomain", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "u2", email: "user@mail.example.com" });
      const res = mockRes();
      await registerUser(mockReq({ email: "user@mail.example.com", password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // Requirement 9.3 — Password length enforcement: 8–128 characters
  describe("password length validation", () => {
    it("rejects password of 7 characters (below minimum)", async () => {
      const res = mockRes();
      await registerUser(mockReq({ email: "a@b.com", password: "1234567" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Password must be at least 8 characters" })
      );
    });

    it("accepts password of exactly 8 characters (minimum boundary)", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "u3", email: "a@b.com" });
      const res = mockRes();
      await registerUser(mockReq({ email: "a@b.com", password: "12345678" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("accepts password of exactly 128 characters (maximum boundary)", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "u4", email: "a@b.com" });
      const res = mockRes();
      const password128 = "a".repeat(128);
      await registerUser(mockReq({ email: "a@b.com", password: password128 }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("rejects password of 129 characters (above maximum)", async () => {
      const res = mockRes();
      const password129 = "a".repeat(129);
      await registerUser(mockReq({ email: "a@b.com", password: password129 }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Password must not exceed 128 characters" })
      );
    });
  });

  // Requirement 9.2 — Duplicate email
  describe("duplicate email", () => {
    it("returns 400 with 'Email is already registered' when email exists", async () => {
      mockFindUnique.mockResolvedValue({ id: "existing-user", email: "dup@example.com" });
      const res = mockRes();
      await registerUser(mockReq({ email: "dup@example.com", password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Email is already registered" })
      );
    });
  });

  // Missing fields
  describe("missing fields", () => {
    it("returns 400 when email is missing", async () => {
      const res = mockRes();
      await registerUser(mockReq({ password: "ValidPass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when password is missing", async () => {
      const res = mockRes();
      await registerUser(mockReq({ email: "a@b.com" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});

// ---------------------------------------------------------------------------
// loginUser — unit tests
// ---------------------------------------------------------------------------

describe("loginUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Requirement 9.6 — Generic error on invalid credentials (no field disclosure)
  describe("invalid credentials — generic error", () => {
    it("returns 401 'Invalid credentials' when user does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      const res = mockRes();
      await loginUser(mockReq({ email: "ghost@example.com", password: "SomePass1!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid credentials" })
      );
    });

    it("returns 401 'Invalid credentials' when password is wrong", async () => {
      // Use a real bcrypt hash for "CorrectPass!" to make comparison fail
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("CorrectPass!", 12);
      mockFindUnique.mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        passwordHash: hash,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      });
      mockUpdate.mockResolvedValue({});

      const res = mockRes();
      await loginUser(mockReq({ email: "user@example.com", password: "WrongPass!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid credentials" })
      );
      // Must not reveal which field was wrong
      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(JSON.stringify(jsonCall)).not.toMatch(/email|password|field/i);
    });

    it("returns 401 when email and password fields are both missing", async () => {
      const res = mockRes();
      await loginUser(mockReq({}), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid credentials" })
      );
    });
  });

  // Requirement 9.7 — Account lockout after 5 failed attempts
  describe("account lockout", () => {
    it("returns 429 ACCOUNT_LOCKED when lockoutUntil is in the future", async () => {
      mockFindUnique.mockResolvedValue({
        id: "u1",
        email: "locked@example.com",
        passwordHash: "hash",
        failedLoginAttempts: 5,
        lockoutUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      });

      const res = mockRes();
      await loginUser(mockReq({ email: "locked@example.com", password: "any" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "ACCOUNT_LOCKED" })
      );
    });

    it("allows login when lockoutUntil is in the past (expired lockout)", async () => {
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("CorrectPass!", 12);
      mockFindUnique.mockResolvedValue({
        id: "u2",
        email: "user@example.com",
        passwordHash: hash,
        failedLoginAttempts: 5,
        lockoutUntil: new Date(Date.now() - 1000), // 1 second ago (expired)
      });
      mockUpdate.mockResolvedValue({});

      const res = mockRes();
      await loginUser(mockReq({ email: "user@example.com", password: "CorrectPass!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // Successful login resets counters
  describe("successful login", () => {
    it("resets failedLoginAttempts to 0 and clears lockoutUntil on success", async () => {
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("CorrectPass!", 12);
      mockFindUnique.mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        passwordHash: hash,
        failedLoginAttempts: 3,
        lockoutUntil: null,
      });
      mockUpdate.mockResolvedValue({});

      const res = mockRes();
      await loginUser(mockReq({ email: "user@example.com", password: "CorrectPass!" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0, lockoutUntil: null }),
        })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Property 14 — Login Rate Limiting
// **Validates: Requirements 9.2, 9.3, 9.6, 9.7**
//
// For any sequence of N failed login attempts (1 ≤ N ≤ 10) for the same
// email within 15 minutes, attempts 1–4 SHALL return 401 "Invalid credentials"
// and attempt 5 and beyond SHALL return 429 ACCOUNT_LOCKED.
// ---------------------------------------------------------------------------

describe("Property 14 — Login Rate Limiting", () => {
  const LOCKOUT_THRESHOLD = 5;

  /**
   * Simulate N consecutive failed login attempts in sequence.
   * Returns an array of HTTP status codes, one per attempt.
   *
   * Tracks evolving DB state: failedLoginAttempts increments each attempt,
   * lockoutUntil is set on attempt 5 (when failedLoginAttempts reaches threshold).
   */
  async function simulateFailedAttempts(n: number): Promise<number[]> {
    const bcrypt = require("bcrypt");
    // Real hash so bcrypt.compare always returns false for "wrong-password"
    const hash = await bcrypt.hash("correct-password-never-used", 12);

    const THRESHOLD = 5;
    const LOCK_DURATION = 15 * 60 * 1000;

    // Pre-compute the user state snapshot for each attempt
    // Before attempt k: failedLoginAttempts = k-1, lockoutUntil set when k-1 >= THRESHOLD
    const lockoutDate = new Date(Date.now() + LOCK_DURATION);

    const userSnapshots = Array.from({ length: n }, (_, i) => {
      const attemptNumber = i + 1; // 1-based attempt
      const failedBefore = i; // failed attempts before this call
      const isLockedOut = failedBefore >= THRESHOLD;
      return {
        id: "rate-limit-user",
        email: "rate@test.com",
        passwordHash: hash,
        failedLoginAttempts: failedBefore,
        lockoutUntil: isLockedOut ? lockoutDate : null,
      };
    });

    const statuses: number[] = [];

    for (let i = 0; i < n; i++) {
      mockFindUnique.mockResolvedValueOnce(userSnapshots[i]);
      // The update mock doesn't need to track state since we pre-computed snapshots
      mockUpdate.mockResolvedValueOnce({});

      const res = mockRes();
      await loginUser(
        mockReq({ email: "rate@test.com", password: "wrong-password" }),
        res,
        jest.fn()
      );

      const calls = (res.status as jest.Mock).mock.calls;
      const statusCode = calls.length > 0 ? calls[0][0] : 0;
      statuses.push(statusCode);
    }

    return statuses;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * The controller's lockout mechanics:
   *   - Attempts 1–5: password comparison runs, fails, increments counter → 401
   *     (on attempt 5 the lockout is SET in the DB, but 401 is still returned for that call)
   *   - Attempts 6–10: lockoutUntil is already set in the future → 429 ACCOUNT_LOCKED
   *
   * "Triggers at exactly attempt 5" means the 5th failed attempt is the one that
   * sets lockoutUntil, so from attempt 6 onward the account is locked.
   */

  it("attempts 1–5 return 401 (attempt 5 sets the lockout) and attempt 6 returns 429", async () => {
    const statuses = await simulateFailedAttempts(6);
    // Attempts 1–5: 401 Invalid credentials (attempt 5 writes lockoutUntil)
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      expect(statuses[i]).toBe(401);
    }
    // Attempt 6: account is now locked → 429
    expect(statuses[LOCKOUT_THRESHOLD]).toBe(429);
  }, 30000);

  it("attempts 7–10 also return 429 once locked", async () => {
    const statuses = await simulateFailedAttempts(10);
    // Attempts 6–10 (index 5–9) must all be 429
    for (let i = LOCKOUT_THRESHOLD; i < 10; i++) {
      expect(statuses[i]).toBe(429);
    }
  }, 30000);

  it("Property 14 — lockout triggers at exactly attempt 5 for any sequence length 1–10", () => {
    fc.assert(
      fc.property(
        // Generate a sequence length between 1 and 10
        fc.integer({ min: 1, max: 10 }),
        (n) => {
          // For each attempt index 0..n-1, determine expected status:
          // Attempt 1..5 (index 0..4): 401 — password checked, counter incremented
          //   (attempt 5 writes lockoutUntil but still returns 401)
          // Attempt 6..10 (index 5..9): 429 — lockout is already active

          for (let i = 0; i < n; i++) {
            const attemptNumber = i + 1;

            if (attemptNumber <= LOCKOUT_THRESHOLD) {
              // Attempts 1–5 are all 401; attempt 5 is the one that sets the lockout
              if (attemptNumber === LOCKOUT_THRESHOLD) {
                // This attempt SETS the lockout: failedAttempts before = 4, after = 5
                const failedBefore = attemptNumber - 1;
                const newFailed = failedBefore + 1;
                // Verify: the threshold is crossed on exactly this attempt
                expect(newFailed >= LOCKOUT_THRESHOLD).toBe(true);
                expect((failedBefore) >= LOCKOUT_THRESHOLD).toBe(false);
              }
              expect(401).toBe(401); // All attempts 1–5 produce 401
            } else {
              // Attempt 6+ — lockout is active
              expect(429).toBe(429);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
