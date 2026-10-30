
import mongoose from "mongoose";

import Reel from "../models/Reel.js";
import ReelLike from "../models/ReelLike.js";
import ReelComment from "../models/ReelComment.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js"
import Notification from "../models/Notification.js";;

// Like reel
export const likeReel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid reel ID", 400);
  }

  const reel = await Reel.findOne({ _id: id, isActive: true });

  if (!reel) {
    throw new AppError("Reel not found", 404);
  }

  const result = await ReelLike.updateOne(
  { reel: id, user: req.user._id },
  {
    $setOnInsert: {
      reel: id,
      user: req.user._id,
    },
  },
  { upsert: true },
);

const isNewLike = result.upsertedCount > 0;

if (
  isNewLike &&
  reel.author.toString() !== req.user._id.toString()
) {
  await Notification.create({
    recipient: reel.author,
    sender: req.user._id,
    type: "like",
    reel: reel._id,
    post: null,
    message: "liked your reel",
  });
}

  const likesCount = await ReelLike.countDocuments({ reel: id });

  return res.status(200).json({
    success: true,
    isLiked: true,
    likesCount,
  });
});

// Unlike reel
export const unlikeReel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid reel ID", 400);
  }

  await ReelLike.deleteOne({
    reel: id,
    user: req.user._id,
  });

  const likesCount = await ReelLike.countDocuments({ reel: id });

  return res.status(200).json({
    success: true,
    isLiked: false,
    likesCount,
  });
});

// Get comments
export const getReelComments = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid reel ID", 400);
  }

  const reel = await Reel.findOne({ _id: id, isActive: true })
    .select("_id")
    .lean();

  if (!reel) {
    throw new AppError("Reel not found", 404);
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
  );

  const [comments, total] = await Promise.all([
    ReelComment.find({ reel: id, isActive: true })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ReelComment.countDocuments({ reel: id, isActive: true }),
  ]);

  return res.status(200).json({
    success: true,
    comments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// Add comment
export const createReelComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const content = req.body.content?.trim();

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid reel ID", 400);
  }

  if (!content) {
    throw new AppError("Comment cannot be empty", 400);
  }

  if (content.length > 1000) {
    throw new AppError("Comment cannot exceed 1000 characters", 400);
  }

  const reel = await Reel.findOne({ _id: id, isActive: true });

  if (!reel) {
    throw new AppError("Reel not found", 404);
  }

  const comment = await ReelComment.create({
    reel: id,
    user: req.user._id,
    content,
  });

  await comment.populate("user", "name avatar");

  if (reel.author.toString() !== req.user._id.toString()) {
  await Notification.create({
    recipient: reel.author,
    sender: req.user._id,
    type: "comment",
    reel: reel._id,
    post: null,
    message: "commented on your reel",
  });
}

  return res.status(201).json({
    success: true,
    message: "Comment added successfully",
    comment,
  });
});


// Delete own reel comment
export const deleteReelComment = asyncHandler(async (req, res) => {
  const { id: reelId, commentId } = req.params;

  if (
    !mongoose.isValidObjectId(reelId) ||
    !mongoose.isValidObjectId(commentId)
  ) {
    throw new AppError("Invalid reel or comment ID", 400);
  }

  const comment = await ReelComment.findOne({
    _id: commentId,
    reel: reelId,
    user: req.user._id,
    isActive: true,
  });

  if (!comment) {
    throw new AppError(
      "Comment not found or you are not allowed to delete it",
      404,
    );
  }

  await comment.deleteOne();

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
    commentId,
  });
});



/* Admin: Get reel comments for moderation */
export const getAdminReelComments = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

  const filter = {};

  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;

  if (req.query.search?.trim()) {
    const escapedSearch = req.query.search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const matchingUsers = await User.find({
      name: { $regex: escapedSearch, $options: "i" },
    }).select("_id");

    filter.$or = [
      { content: { $regex: escapedSearch, $options: "i" } },
      { user: { $in: matchingUsers.map((user) => user._id) } },
    ];
  }

  const [comments, total] = await Promise.all([
    ReelComment.find(filter)
      .populate("user", "name email avatar")
      .populate("reel", "caption videoUrl isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    ReelComment.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    results: comments.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    comments,
  });
});

/* Admin: Deactivate or restore a reel comment */
export const updateAdminReelCommentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid comment ID", 400);
  }

  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400);
  }

  const comment = await ReelComment.findByIdAndUpdate(
    id,
    { $set: { isActive } },
    { returnDocument: "after", runValidators: true },
  );

  if (!comment) {
    throw new AppError("Reel comment not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: `Reel comment ${isActive ? "restored" : "deactivated"} successfully`,
    comment,
  });
});
