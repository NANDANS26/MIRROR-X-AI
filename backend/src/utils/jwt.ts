import jwt from "jsonwebtoken";

import { ENV } from "../configs/env";

export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export const signToken = (
  userId: string
) => {
  return jwt.sign(
    {
      userId,
    },
    ENV.JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );
};

export const verifyToken = (
  token: string
): JwtPayload => {
  return jwt.verify(
    token,
    ENV.JWT_SECRET
  ) as JwtPayload;
};