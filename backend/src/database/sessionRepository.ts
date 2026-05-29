import { prisma } from "./prisma";

export const createSession =
  async (data: any) => {
    return prisma.analysisSession.create({
      data,
    });
  };

export const getSession =
  async (sessionId: string) => {
    return prisma.analysisSession.findUnique({
      where: {
        id: sessionId,
      },
    });
  };

export const getUserSessions =
  async (userId: string) => {
    return prisma.analysisSession.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  };

export const updateSessionReport =
  async (
    sessionId: string,
    reportPath: string
  ) => {
    return prisma.analysisSession.update({
      where: {
        id: sessionId,
      },

      data: {
        reportPath,
      },
    });
  };