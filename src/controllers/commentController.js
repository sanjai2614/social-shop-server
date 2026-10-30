import mongoose from "mongoose";

import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import Notification from "../models/Notification.js";

// Create a comment
export const createComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const post = await Post.findOne({
  _id: id,
  isActive: true,
});

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  const comment = await Comment.create({
    content,
    author: req.user._id,
    post: post._id,
  });

  if (post.author.toString() !== req.user._id.toString()) {
    try {
      console.log("Post author:", post.author.toString());
      console.log("Comment user:", req.user._id.toString());
      console.log(
        "Same user:",
        post.author.toString() === req.user._id.toString(),
      );
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: "comment",
        post: post._id,
        message: "commented on your post",
      });
    } catch (error) {
      console.error("Comment notification failed:", error.message);
    }
  }

  await comment.populate("author", "name avatar");

  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: { comment },
  });
});

// Get comments for a post

export const getPostComments = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid post ID", 400);
  }

  const post = await Post.findOne({
    _id: id,
    isActive: true,
  });

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  const comments = await Comment.find({
    post: post._id,
    isActive: true,
  })
    .populate("author", "name avatar")
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    results: comments.length,
    data: { comments },
  });
});


// Delete own comment
export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  const isOwner = comment.author.toString() === req.user._id.toString();

  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError("You can only delete your own comments", 403);
  }

  await comment.deleteOne();

  res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});



/* Admin: List comments with search and pagination */
export const getAdminComments = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const filter = {};

  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;

  if (req.query.search?.trim()) {
    const escapedSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.content = { $regex: escapedSearch, $options: "i" };
  }

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .populate("author", "name email avatar")
      .populate("post", "content")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Comment.countDocuments(filter),
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


/* Admin: Deactivate or restore a comment */
export const updateAdminCommentStatus = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(commentId)) {
    throw new AppError("Invalid comment ID", 400);
  }

  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400);
  }

  const comment = await Comment.findByIdAndUpdate(
    commentId,
    { $set: { isActive } },
    { returnDocument: "after", runValidators: true }
  );

  if (!comment) throw new AppError("Comment not found", 404);

  return res.status(200).json({
    success: true,
    message: `Comment ${isActive ? "restored" : "deactivated"} successfully`,
    comment,
  });
});
