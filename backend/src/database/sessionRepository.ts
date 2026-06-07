/**
 * sessionRepository.ts — Prisma session data access functions.
 *
 * Validates: Requirements 8.5, 9.8, 10.1, 10.2, 10.3, 10.4
 */

import { prisma } from "./prisma";

const SESSION_EXPIRY_DAYS = 30;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createSession = async (data: {
  userId: string;
  sourceType: string;
  sourceUrl?: string;
  sourceFilename?: string;
  imageUrl: string;
  pageTitle?: string;
  metaDescription?: string;
  status: string;
  [key: string]: unknown;
}) => {
  const now = new Date();
  return prisma.analysisSession.create({
    data: {
      ...data,
      expiresAt: new Date(now.getTime() + SESSION_EXPIRY_MS),
    },
  });
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export const getSession = async (sessionId: string) => {
  return prisma.analysisSession.findUnique({
    where: { id: sessionId },
    include: {
      detectedPatterns: true,
      simulationResults: true,
      scoringResult: true,
      chatMessages: {
        orderBy: { timestamp: "asc" },
        take: 10,
      },
    },
  });
};

/**
 * Return up to 100 sessions for a user, ordered by most recent first.
 * Validates: Requirement 10.1
 */
export const getUserSessions = async (userId: string) => {
  return prisma.analysisSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
};

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export const updateSessionReport = async (
  sessionId: string,
  reportPath: string
) => {
  const reportExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  return prisma.analysisSession.update({
    where: { id: sessionId },
    data: {
      reportPath,
      reportExpiresAt,
    },
  });
};

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Permanently delete a session and all cascade records.
 * Validates: Requirement 10.4
 */
export const deleteSession = async (sessionId: string) => {
  // Delete in dependency order to satisfy FK constraints
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { sessionId } }),
    prisma.detectedPatternRecord.deleteMany({ where: { sessionId } }),
    prisma.simulationResultRecord.deleteMany({ where: { sessionId } }),
    prisma.scoringResult.deleteMany({ where: { sessionId } }),
    prisma.analysisSession.delete({ where: { id: sessionId } }),
  ]);
};
