import jwt from "jsonwebtoken";

import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

export const protect = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  const token = authorization.split(" ")[1];

  let decoded;

  try {
    decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }

  if (decoded.type !== "access" || !decoded.sub) {
    throw new AppError("Invalid access token", 401);
  }

  const user = await User.findById(decoded.sub);

  if (!user || !user.isActive) {
    throw new AppError("User not found or inactive", 401);
  }

  req.user = user;

  next();
});

export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission", 403));
    }

    next();
  };
