import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import { ENV } from "./configs/env";

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

app.use(cors());

app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

app.use("/api/test", testRoutes);
app.use(
  "/api/analysis",
  analysisRoutes
);

app.use(
  "/api/chat",
  chatRoutes
);

app.use(
  "/api/report",
  reportRoutes
);
app.use(errorMiddleware);

server.listen(ENV.PORT, () => {
  console.log(`Backend running on port ${ENV.PORT}`);
});