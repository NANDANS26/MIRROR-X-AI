import jwt from "jsonwebtoken";

import { ENV } from "../configs/env";

export const signToken = (userId: string) => {
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

export const verifyToken = (token: string) => {
  return jwt.verify(token, ENV.JWT_SECRET);
};