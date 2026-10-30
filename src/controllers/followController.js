import mongoose from "mongoose";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import Notification from "../models/Notification.js";

// Follow a user
export const followUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid user ID", 400);
  }

  if (currentUserId.toString() === id) {
    throw new AppError("You cannot follow yourself", 400);
  }

  const targetUser = await User.findOne({
    _id: id,
    isActive: true,
  });

  if (!targetUser) {
    throw new AppError("User not found", 404);
  }

  const alreadyFollowing = await User.exists({
  _id: currentUserId,
  following: targetUser._id,
});

  await User.updateOne(
    { _id: currentUserId },
    { $addToSet: { following: targetUser._id } },
  );

  await User.updateOne(
    { _id: targetUser._id },
    { $addToSet: { followers: currentUserId } },
  );

 if (!alreadyFollowing) {
  try {
    await Notification.create({
      recipient: targetUser._id,
      sender: currentUserId,
      type: "follow",
      message: "started following you",
    });
  } catch (error) {
    console.error(
      "Follow notification failed:",
      error.message
    );
  }
}

 const [updatedTargetUser, updatedCurrentUser] = await Promise.all([
  User.findById(targetUser._id).select("followers"),
  User.findById(currentUserId).select("following"),
]);

res.status(200).json({
  success: true,
  message: "User followed successfully",
  isFollowing: true,
  followersCount: updatedTargetUser.followers.length,
  followingCount: updatedCurrentUser.following.length,
});
});

// Unfollow a user
export const unfollowUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid user ID", 400);
  }

  if (currentUserId.toString() === id) {
    throw new AppError("You cannot unfollow yourself", 400);
  }

  const targetUser = await User.findOne({
    _id: id,
    isActive: true,
  });

  if (!targetUser) {
    throw new AppError("User not found", 404);
  }

  await User.updateOne(
    { _id: currentUserId },
    { $pull: { following: targetUser._id } },
  );

  await User.updateOne(
    { _id: targetUser._id },
    { $pull: { followers: currentUserId } },
  );

  res.status(200).json({
    success: true,
    message: "User unfollowed successfully",
    isFollowing: false,
  });
});

/* Get a user's followers */
export const getFollowers = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid user ID", 400);
  }

  const user = await User.findOne({
    _id: id,
    isActive: true,
  })
    .select("followers")
    .populate("followers", "name avatar bio");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    success: true,
    results: user.followers.length,
    data: {
      followers: user.followers,
    },
  });
});

/* Get users that a user follows */
export const getFollowing = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid user ID", 400);
  }

  const user = await User.findOne({
    _id: id,
    isActive: true,
  })
    .select("following")
    .populate("following", "name avatar bio");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    success: true,
    results: user.following.length,
    data: {
      following: user.following,
    },
  });
});
