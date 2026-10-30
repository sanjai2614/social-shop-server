
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
} from "../utils/generateTokens.js";
import { env } from "../config/env.js";

// Reusable authentication response
const sendAuthResponse = (res, user, statusCode = 200) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  setRefreshTokenCookie(res, refreshToken);

  return res.status(statusCode).json({
    success: true,
    message: "Authentication successful",
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
};

// Register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const normalizedEmail = email.toLowerCase();

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new AppError("Email is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
  });

  return sendAuthResponse(res, user, 201);
});

// Login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({
    email: email.toLowerCase(),
  }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Your account has been deactivated", 403);
  }

  return sendAuthResponse(res, user);
});

// Refresh access token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.socialShoppingRefreshToken;

  if (!refreshToken) {
    throw new AppError("Refresh token is missing", 401);
  }

  let decoded;

  try {
    decoded = jwt.verify(
      refreshToken,
      env.REFRESH_TOKEN_SECRET
    );
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (decoded.type !== "refresh" || !decoded.sub) {
    throw new AppError("Invalid refresh token", 401);
  }

  const user = await User.findById(decoded.sub);

  if (!user || !user.isActive) {
    throw new AppError("User not found or inactive", 401);
  }

  const accessToken = generateAccessToken(user._id);

  return res.status(200).json({
    success: true,
    accessToken,
  });
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("socialShoppingRefreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/v1/auth",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});



export const getMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      avatar: req.user.avatar,
      bio: req.user.bio,
      followers: req.user.followers.length,
      following: req.user.following.length,
      createdAt: req.user.createdAt,
    },
  });
});
