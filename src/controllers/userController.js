import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "node:stream";

import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";



/* Search users */
export const searchUsers = asyncHandler(async (req, res) => {
  const search = req.query.q?.trim();

  if (!search) {
    return res.status(200).json({
      success: true,
      results: 0,
      users: [],
    });
  }

  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const users = await User.find({
    name: {
      $regex: escapedSearch,
      $options: "i",
    },
    isActive: true,
  })
    .select("name avatar bio followers following createdAt")
    .sort({ name: 1 })
    .limit(20);

  const formattedUsers = users.map((user) => ({
    id: user._id,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    followersCount: user.followers.length,
    followingCount: user.following.length,
    createdAt: user.createdAt,
  }));

  return res.status(200).json({
    success: true,
    results: formattedUsers.length,
    users: formattedUsers,
  });
});



/* Get public profile */
export const getUserProfile = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError("Invalid user ID", 400);
  }

  const user = await User.findOne({
    _id: req.params.id,
    isActive: true,
  }).select("name avatar bio followers following createdAt");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const currentUserId = req.user?._id;

  const isFollowing = currentUserId
    ? user.followers.some(
        (followerId) =>
          followerId.toString() === currentUserId.toString()
      )
    : false;

  return res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      isFollowing,
      createdAt: user.createdAt,
    },
  });
});


// Update own profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, avatar } = req.body;

  const updates = {};

  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (avatar !== undefined) updates.avatar = avatar;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    {
      returnDocument:'after',
      runValidators: true,
    },
  ).select("name email role avatar bio");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user,
  });
});

// Upload own profile avatar
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("Please select an image", 400);
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const uploadResult = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "social-shopping/avatars",
        resource_type: "image",
        transformation: [
          { width: 500, height: 500, crop: "limit" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    Readable.from(req.file.buffer).pipe(uploadStream);
  });

  user.avatar = uploadResult.secure_url;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Profile avatar updated successfully",
    user: {
      id: user._id,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
    },
  });
});

// Change own password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.password,
  );

  if (!isPasswordCorrect) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });
});



/* Admin: Get customers with search and pagination */
export const getAdminUsers = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Number.parseInt(req.query.page, 10) || 1
  );

  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
  );

  const filter = { role: "customer" };

  if (req.query.status === "active") {
    filter.isActive = true;
  } else if (req.query.status === "inactive") {
    filter.isActive = false;
  }

  if (req.query.search?.trim()) {
    const escapedSearch = req.query.search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email avatar role isActive createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    User.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    results: users.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    users,
  });
});


/* Admin: Activate or deactivate a customer */
export const updateCustomerStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid user ID", 400);
  }

  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400);
  }

  const user = await User.findOneAndUpdate(
    { _id: id, role: "customer" },
    { $set: { isActive } },
    {
      returnDocument: "after",
      runValidators: true,
    }
  ).select("name email role isActive");

  if (!user) {
    throw new AppError("Customer not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: `Customer ${isActive ? "activated" : "deactivated"} successfully`,
    user,
  });
});
