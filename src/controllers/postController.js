import mongoose from "mongoose";

import Post from "../models/Post.js";
import Product from "../models/Product.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import SavedPost from "../models/SavedPost.js";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "node:stream";



const uploadImageToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "social-shopping/posts",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    Readable.from(file.buffer).pipe(stream);
  });


// Create post
export const createPost = asyncHandler(async (req, res) => {
  const content = req.body.content?.trim() ?? "";

  let taggedProducts = req.body.taggedProducts ?? [];

  if (typeof taggedProducts === "string") {
    try {
      taggedProducts = JSON.parse(taggedProducts);
    } catch {
      taggedProducts = [taggedProducts];
    }
  }

  if (!Array.isArray(taggedProducts)) {
    throw new AppError("Invalid tagged products", 400);
  }

  const files = req.files ?? [];

  if (!content && files.length === 0) {
    throw new AppError(
      "A post must contain text or at least one image",
      400,
    );
  }

  const uniqueIds = [...new Set(taggedProducts)];

  if (uniqueIds.length > 0) {
    const products = await Product.find({
      _id: { $in: uniqueIds },
      isActive: true,
    }).select("_id");

    if (products.length !== uniqueIds.length) {
      throw new AppError(
        "One or more products are unavailable",
        400,
      );
    }
  }

  const uploadedImages = await Promise.all(
    files.map(uploadImageToCloudinary),
  );

  const images = uploadedImages.map((image) => image.secure_url);

  const post = await Post.create({
    content,
    images,
    taggedProducts: uniqueIds,
    author: req.user._id,
  });

  await post.populate([
    { path: "author", select: "name avatar" },
    { path: "taggedProducts", select: "name price images" },
  ]);

  return res.status(201).json({
    success: true,
    message: "Post created successfully",
    post,
  });
});


// Get all active product-tagged/social posts

export const getPosts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );

const search = req.query.search?.trim();
const filter = { isActive: true };

if (search) {
  // Regex special characters escape pannuvom
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const matchingUsers = await User.find({
    name: {
      $regex: escapedSearch,
      $options: "i",
    },
    isActive: true,
  }).select("_id");

  filter.$or = [
    {
      content: {
        $regex: escapedSearch,
        $options: "i",
      },
    },
    {
      author: {
        $in: matchingUsers.map((user) => user._id),
      },
    },
  ];
}

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate("author", "name avatar")
      .populate("taggedProducts", "name price images isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Post.countDocuments(filter),
  ]);

  const postIds = posts.map((post) => post._id);

  const savedPosts = await SavedPost.find({
    user: req.user._id,
    post: { $in: postIds },
  }).select("post");

  const savedPostIds = new Set(savedPosts.map((item) => item.post.toString()));

  const commentStats = postIds.length
    ? await Comment.aggregate([
        {
  $match: {
    post: { $in: postIds },
    isActive: true,
  },
},
        {
          $group: {
            _id: "$post",
            commentsCount: { $sum: 1 },
          },
        },
      ])
    : [];

  const commentCountMap = new Map(
    commentStats.map((item) => [item._id.toString(), item.commentsCount]),
  );

  const likeStats = postIds.length
    ? await Like.aggregate([
        {
          $match: {
            post: { $in: postIds },
          },
        },
        {
          $group: {
            _id: "$post",
            likesCount: { $sum: 1 },
            likedByCurrentUser: {
              $sum: {
                $cond: [{ $eq: ["$user", req.user._id] }, 1, 0],
              },
            },
          },
        },
      ])
    : [];

  const likeStatsMap = new Map(
    likeStats.map((item) => [
      item._id.toString(),
      {
        likesCount: item.likesCount,
        isLiked: item.likedByCurrentUser > 0,
      },
    ]),
  );

  const formattedPosts = posts.map((post) => ({
    ...post.toObject(),
    likesCount: likeStatsMap.get(post._id.toString())?.likesCount ?? 0,
    isLiked: likeStatsMap.get(post._id.toString())?.isLiked ?? false,
    commentsCount: commentCountMap.get(post._id.toString()) ?? 0,
    isSaved: savedPostIds.has(post._id.toString()),
  }));

  return res.status(200).json({
    success: true,
    count: formattedPosts.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    posts: formattedPosts,
  });
});

// Get single post
export const getPostById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid post ID", 400);
  }

  const post = await Post.findOne({
  _id: id,
  isActive: true,
})
    .populate("author", "name avatar")
    .populate("taggedProducts", "name price images isActive");

  if (!post) {
    throw new AppError("Post not found", 404);
  }

  return res.status(200).json({
    success: true,
    post,
  });
});

// Update own post
export const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid post ID", 400);
  }

  const post = await Post.findOne({
  _id: id,
  author: req.user._id,
  isActive: true,
});

  if (!post) {
    throw new AppError("Post not found or you do not own this post", 404);
  }

  const { taggedProducts } = req.body;

  if (taggedProducts !== undefined && taggedProducts.length > 0) {
    const uniqueIds = [...new Set(taggedProducts)];

    const products = await Product.find({
      _id: { $in: uniqueIds },
      isActive: true,
    }).select("_id");

    if (products.length !== uniqueIds.length) {
      throw new AppError("One or more products are unavailable", 400);
    }

    post.taggedProducts = uniqueIds;
  }

  if (req.body.content !== undefined) {
    post.content = req.body.content;
  }

  if (req.body.images !== undefined) {
    post.images = req.body.images;
  }

  if (!post.content?.trim() && (!post.images || post.images.length === 0)) {
    throw new AppError("A post must contain text or at least one image", 400);
  }

  await post.save();

  await post.populate([
    { path: "author", select: "name avatar" },
    { path: "taggedProducts", select: "name price images isActive" },
  ]);

  return res.status(200).json({
    success: true,
    message: "Post updated successfully",
    post,
  });
});

// Delete own post
export const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid post ID", 400);
  }

  const post = await Post.findOneAndDelete({
    _id: id,
    author: req.user._id,
  });

  if (!post) {
    throw new AppError("Post not found or you do not own this post", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Post deleted successfully",
  });
});



/* Admin: Get posts for moderation */
export const getAdminPosts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const filter = {};

  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;

  if (req.query.search?.trim()) {
    const escapedSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingUsers = await User.find({
      name: { $regex: escapedSearch, $options: "i" },
    }).select("_id");

    filter.$or = [
      { content: { $regex: escapedSearch, $options: "i" } },
      { author: { $in: matchingUsers.map((user) => user._id) } },
    ];
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate("author", "name email avatar")
      .populate("taggedProducts", "name price images")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Post.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    results: posts.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    posts,
  });
});


/* Admin: Deactivate or restore a post */
export const updateAdminPostStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid post ID", 400);
  }

  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400);
  }

  const post = await Post.findByIdAndUpdate(
    id,
    { $set: { isActive } },
    { returnDocument: "after", runValidators: true }
  );

  if (!post) throw new AppError("Post not found", 404);

  return res.status(200).json({
    success: true,
    message: `Post ${isActive ? "restored" : "deactivated"} successfully`,
    post,
  });
});
