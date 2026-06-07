import express from "express";
import cors from "cors";
import http from "http";
import { Server, Socket } from "socket.io";

import { ENV } from "./configs/env";
import { prisma } from "./database/prisma";

import healthRoutes from "./routes/healthRoutes";
import { errorMiddleware } from "./middleware/errorMiddleware";
import authRoutes from "./routes/authRoutes";
import testRoutes from "./routes/testRoutes";
import analysisRoutes from "./routes/analysisRoutes";
import chatRoutes from "./routes/chatRoutes";
import reportRoutes from "./routes/reportRoutes";

const app = express();

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ── WebSocket session rooms ────────────────────────────────────────────────────
// On connection, the client passes a sessionId in the socket handshake query.
// We join the socket to a room identified by that sessionId so the pipeline
// orchestrator can emit targeted events via io.to(socketId).emit(...)
// (socketId is used as the room id throughout the pipeline).
//
// Validates: Requirement 11.1
io.on("connection", (socket: Socket) => {
  const sessionId = socket.handshake.query.sessionId as string | undefined;

  if (sessionId) {
    // Join the room named after the sessionId so targeted events work
    socket.join(sessionId);
  }

  // Also join the socket's own id room (default behavior — enables io.to(socket.id))
  // The pipeline orchestrator uses socketId (socket.id) for targeted delivery.
  socket.on("join_session", (sid: string) => {
    if (sid) {
      socket.join(sid);
    }
  });

  socket.on("disconnect", () => {
    // Cleanup is automatic — Socket.io removes the socket from all rooms on disconnect
  });
});

// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({
     origin: process.env.FRONTEND_URL || '*',
     credentials: true,
   }))
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/report", reportRoutes);

app.use(errorMiddleware);

// ── Startup: verify DB connection before accepting traffic ──────────────────
async function startServer() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[startup] Database connection verified ✓");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[startup] ⚠ Database unreachable: ${msg}`);
    console.error("[startup] Server will start but DB-dependent routes will return 503.");
    // Don't exit — allow health endpoint to report DB status to frontend
  }

  server.listen(ENV.PORT, () => {
    console.log(`Backend running on port ${ENV.PORT}`);
  });
}

startServer();
