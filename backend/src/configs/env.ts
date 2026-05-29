import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT || "3001",

  DATABASE_URL: process.env.DATABASE_URL || "",

  JWT_SECRET: process.env.JWT_SECRET || "",

  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "",
};

if (!ENV.DATABASE_URL) {
  throw new Error("DATABASE_URL missing in .env");
}

if (!ENV.JWT_SECRET) {
  throw new Error("JWT_SECRET missing in .env");
}