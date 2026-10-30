import SavedPost from "../models/SavedPost.js";
import Post from "../models/Post.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

import Like from "../models/Like.js";
import Comment from "../models/Comment.js";

// Save a post
export const savePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findById(id);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  try {
    await SavedPost.create({
      user: req.user._id,
      post: post._id,
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }

  res.status(200).json({
    success: true,
    message: "Post saved successfully",
    saved: true,
  });
});

// Unsave a post
export const unsavePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findById(id);

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  await SavedPost.findOneAndDelete({
    user: req.user._id,
    post: post._id,
  });

  res.status(200).json({
    success: true,
    message: "Post removed from saved posts",
    saved: false,
  });
});

// Get logged-in user's saved posts
export const getSavedPosts = asyncHandler(async (req, res) => {
  const savedPosts = await SavedPost.find({
    user: req.user._id,
  })
    .populate({
      path: "post",
      populate: [
        { path: "author", select: "name avatar" },
        { path: "taggedProducts", select: "name price images" },
      ],
    })
    .sort({ createdAt: -1 });

  const validSavedPosts = await Promise.all(
    savedPosts
      .filter((savedPost) => savedPost.post !== null)
      .map(async (savedPost) => {
        const post = savedPost.post;
        const postId = post._id;

        const [likesCount, commentsCount, currentUserLike] =
          await Promise.all([
            Like.countDocuments({ post: postId }),
            Comment.countDocuments({ post: postId }),
            Like.findOne({
              post: postId,
              user: req.user._id,
            }).select("_id"),
          ]);

        return {
          ...savedPost.toObject(),
          post: {
            ...post.toObject(),
            likesCount,
            commentsCount,
            isLiked: Boolean(currentUserLike),
            isSaved: true,
          },
        };
      }),
  );

  res.status(200).json({
    success: true,
    results: validSavedPosts.length,
    data: {
      savedPosts: validSavedPosts,
    },
  });
});