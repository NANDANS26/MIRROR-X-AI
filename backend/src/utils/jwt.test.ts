/**
 * Tests for JWT utilities (signToken / verifyToken).
 *
 * Property 13: Token expiry claim equals issuedAt + exactly 24 hours.
 *
 * Validates: Requirements 9.4, 9.5
 */

// Set env vars BEFORE importing env.ts (which throws on missing vars)
process.env.JWT_SECRET = "test-secret-for-jwt-tests";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.AI_SERVICE_URL = "http://localhost:8000";

// Mock the env module to prevent validation throws in configs/env.ts
jest.mock("../configs/env", () => ({
  ENV: {
    JWT_SECRET: "test-secret-for-jwt-tests",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    AI_SERVICE_URL: "http://localhost:8000",
    PORT: "3001",
  },
}));

import * as fc from "fast-check";
import jwt from "jsonwebtoken";
import { signToken, verifyToken } from "./jwt";

const TWENTY_FOUR_HOURS_S = 24 * 60 * 60; // 86400 seconds
// Allow ±2s tolerance for test execution time
const TOLERANCE_S = 2;

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("signToken", () => {
  it("returns a non-empty string token", () => {
    const token = signToken("user-123");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("token contains three JWT segments (header.payload.signature)", () => {
    const token = signToken("user-abc");
    expect(token.split(".")).toHaveLength(3);
  });

  it("payload contains the userId claim", () => {
    const userId = "test-user-id-42";
    const token = signToken(userId);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded).not.toBeNull();
    expect(decoded.userId).toBe(userId);
  });

  it("payload contains an iat (issued-at) claim", () => {
    const token = signToken("u1");
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(typeof decoded.iat).toBe("number");
  });

  it("payload contains an exp (expiry) claim", () => {
    const token = signToken("u1");
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(typeof decoded.exp).toBe("number");
  });

  it("expiry is approximately 24 hours after issuedAt", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signToken("u1");
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    const delta = decoded.exp - decoded.iat;
    expect(delta).toBeGreaterThanOrEqual(TWENTY_FOUR_HOURS_S - TOLERANCE_S);
    expect(delta).toBeLessThanOrEqual(TWENTY_FOUR_HOURS_S + TOLERANCE_S);
  });
});

// ---------------------------------------------------------------------------
// verifyToken unit tests
// ---------------------------------------------------------------------------

describe("verifyToken", () => {
  it("returns the userId from a valid token", () => {
    const userId = "verify-test-user";
    const token = signToken(userId);
    const payload = verifyToken(token);
    expect(payload.userId).toBe(userId);
  });

  it("throws on a tampered token", () => {
    const token = signToken("tamper-test");
    const [header, payload, sig] = token.split(".");
    const tamperedToken = `${header}.${payload}.${sig}x`;
    expect(() => verifyToken(tamperedToken)).toThrow();
  });

  it("throws on an expired token", () => {
    const expiredToken = jwt.sign(
      { userId: "expired-user" },
      process.env.JWT_SECRET!,
      { expiresIn: "0s" }
    );
    expect(() => verifyToken(expiredToken)).toThrow();
  });

  it("throws on a token signed with a different secret", () => {
    const wrongSecretToken = jwt.sign(
      { userId: "wrong-secret" },
      "completely-different-secret",
      { expiresIn: "24h" }
    );
    expect(() => verifyToken(wrongSecretToken)).toThrow();
  });

  it("throws on an empty string", () => {
    expect(() => verifyToken("")).toThrow();
  });

  it("throws on a completely invalid string", () => {
    expect(() => verifyToken("not.a.token")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Property 13 — Token expiry invariant
// Validates: Requirements 9.4, 9.5
//
// For any userId string, the token's exp claim must equal iat + exactly
// 24 hours (within tolerance for test execution time).
// ---------------------------------------------------------------------------

describe("Property 13 — JWT expiry invariant", () => {
  it("exp === iat + 24h for any userId", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary userId strings (non-empty)
        fc.string({ minLength: 1, maxLength: 64 }),
        (userId) => {
          const token = signToken(userId);
          const decoded = jwt.decode(token) as { iat: number; exp: number; userId: string };

          // userId is preserved
          expect(decoded.userId).toBe(userId);

          // exp - iat must equal 24 hours (±tolerance)
          const delta = decoded.exp - decoded.iat;
          expect(delta).toBeGreaterThanOrEqual(TWENTY_FOUR_HOURS_S - TOLERANCE_S);
          expect(delta).toBeLessThanOrEqual(TWENTY_FOUR_HOURS_S + TOLERANCE_S);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("token is verifiable for any userId", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        (userId) => {
          const token = signToken(userId);
          const payload = verifyToken(token);
          expect(payload.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
