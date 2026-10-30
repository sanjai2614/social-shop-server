import Like from "../models/Like.js";
import Post from "../models/Post.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import Notification from "../models/Notification.js";

// Like a post

export const likePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findById(id);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  let isNewLike = false;

  try {
    await Like.create({
      user: req.user._id,
      post: post._id,
    });

    isNewLike = true;
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }

  // Create notification only for a new like
  if (
    isNewLike &&
    post.author.toString() !== req.user._id.toString()
  ) {
    try {
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: "like",
        post: post._id,
        message: "liked your post",
      });
    } catch (error) {
      // Notification failure shouldn't fail the like request
      console.error("Like notification failed:", error.message);
    }
  }

  const likesCount = await Like.countDocuments({
    post: post._id,
  });

  res.status(200).json({
    success: true,
    message: "Post liked successfully",
    liked: true,
    likesCount,
  });
});


// Unlike a post
export const unlikePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findById(id);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  await Like.findOneAndDelete({
    user: req.user._id,
    post: post._id,
  });

  const likesCount = await Like.countDocuments({ post: post._id });

  res.status(200).json({
    success: true,
    message: "Post unliked successfully",
    liked: false,
    likesCount,
  });
});
