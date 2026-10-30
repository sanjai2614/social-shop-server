import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const generateAccessToken = (userId) => {
  return jwt.sign(
    { sub: userId.toString(), type: "access" },
    env.ACCESS_TOKEN_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN },
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { sub: userId.toString(), type: "refresh" },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN },
  );
};

export const setRefreshTokenCookie = (res, token) => {
  res.cookie("socialShoppingRefreshToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/v1/auth",
  });
};
