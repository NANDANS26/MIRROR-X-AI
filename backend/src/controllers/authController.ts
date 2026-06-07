import { Request, Response } from "express";
import bcrypt from "bcrypt";

import { prisma } from "../database/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { signToken } from "../utils/jwt";

// RFC 5321-compliant email regex (covers common valid emails)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LOCKOUT_THRESHOLD = 5;       // attempts before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes in ms

export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // RFC 5321 email validation
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Password length enforcement: 8–128 characters
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }
    if (password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must not exceed 128 characters",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
      },
    });

    const token = signToken(user.id);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  }
);

export const loginUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // No field disclosure — return generic message
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check lockout BEFORE validating credentials
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      return res.status(429).json({
        success: false,
        error: "ACCOUNT_LOCKED",
        message: "Account is temporarily locked due to too many failed login attempts. Please try again later.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordCorrect) {
      // Increment failed attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLockout = newFailedAttempts >= LOCKOUT_THRESHOLD;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockoutUntil: shouldLockout
            ? new Date(Date.now() + LOCKOUT_DURATION_MS)
            : undefined,
        },
      });

      // Generic error — no field disclosure (Requirement 9.6)
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Successful login — reset failed attempts and lockout
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    const token = signToken(user.id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  }
);
