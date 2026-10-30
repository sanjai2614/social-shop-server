
import mongoose from "mongoose";
import { Readable } from "node:stream";

import Reel from "../models/Reel.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import cloudinary from "../config/cloudinary.js";
import ReelLike from "../models/ReelLike.js";
import ReelComment from "../models/ReelComment.js";

const uploadVideoToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "social-shopping/reels",
        resource_type: "video",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    Readable.from(file.buffer).pipe(stream);
  });

const parseTaggedProducts = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  let ids = value;

  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch {
      throw new AppError("Invalid tagged products format", 400);
    }
  }

  if (!Array.isArray(ids)) {
    throw new AppError("Tagged products must be an array", 400);
  }

  if (ids.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    throw new AppError("Invalid product ID", 400);
  }

  return [...new Set(ids.map(String))];
};

// Create reel
export const createReel = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("Please upload a video", 400);
  }

  const caption = req.body.caption?.trim() ?? "";

  if (caption.length > 2000) {
    throw new AppError("Caption cannot exceed 2000 characters", 400);
  }

  const taggedProducts = parseTaggedProducts(
    req.body.taggedProducts,
  );

  if (taggedProducts.length > 20) {
    throw new AppError("You can tag up to 20 products", 400);
  }

  if (taggedProducts.length > 0) {
    const products = await Product.find({
      _id: { $in: taggedProducts },
      isActive: true,
    }).select("_id");

    if (products.length !== taggedProducts.length) {
      throw new AppError(
        "One or more products are unavailable",
        400,
      );
    }
  }

  const uploadedVideo = await uploadVideoToCloudinary(req.file);

  try {
    const reel = await Reel.create({
      videoUrl: uploadedVideo.secure_url,
      videoPublicId: uploadedVideo.public_id,
      caption,
      taggedProducts,
      author: req.user._id,
    });

    await reel.populate([
      { path: "author", select: "name avatar" },
      {
        path: "taggedProducts",
        select: "name price images isActive",
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Reel created successfully",
      reel,
    });
  } catch (error) {
    // Database save fail aana Cloudinary-la orphan video avoid pannuvom.
    await cloudinary.uploader
      .destroy(uploadedVideo.public_id, {
        resource_type: "video",
      })
      .catch(() => {});

    throw error;
  }
});

// Get reels feed
export const getReels = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Number.parseInt(req.query.page, 10) || 1,
  );

  const limit = Math.min(
    20,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );

  const filter = { isActive: true };

  const [reels, total] = await Promise.all([
    Reel.find(filter)
      .populate("author", "name avatar")
      .populate(
        "taggedProducts",
        "name price images isActive",
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Reel.countDocuments(filter),
  ]);

  // No reels irundha empty array return pannuvom
  if (reels.length === 0) {
    return res.status(200).json({
      success: true,
      count: 0,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      reels: [],
    });
  }

  const reelIds = reels.map((reel) => reel._id);


  const commentCounts = await ReelComment.aggregate([
  {
    $match: {
      reel: { $in: reelIds },
      isActive: true,
    },
  },
  {
    $group: {
      _id: "$reel",
      commentsCount: { $sum: 1 },
    },
  },
]);

const commentsCountMap = new Map(
  commentCounts.map((item) => [
    item._id.toString(),
    item.commentsCount,
  ]),
);

  // Total likes + current user's likes fetch pannuvom
  const [likeCounts, userLikes] = await Promise.all([
    ReelLike.aggregate([
      {
        $match: {
          reel: { $in: reelIds },
        },
      },
      {
        $group: {
          _id: "$reel",
          likesCount: { $sum: 1 },
        },
      },
    ]),

    // Protected route-na current user ID irukkum
    req.user?._id
      ? ReelLike.find({
          reel: { $in: reelIds },
          user: req.user._id,
        })
          .select("reel")
          .lean()
      : Promise.resolve([]),
  ]);

  const likesCountMap = new Map(
    likeCounts.map((item) => [
      item._id.toString(),
      item.likesCount,
    ]),
  );

  const likedReelIds = new Set(
    userLikes.map((item) => item.reel.toString()),
  );

  const reelsWithLikes = reels.map((reel) => ({
  ...reel,
  likesCount: likesCountMap.get(reel._id.toString()) ?? 0,
  isLiked: likedReelIds.has(reel._id.toString()),
  commentsCount:
    commentsCountMap.get(reel._id.toString()) ?? 0,
}));

  return res.status(200).json({
    success: true,
    count: reelsWithLikes.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    reels: reelsWithLikes,
  });
});
// Get single reel
export const getReelById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid reel ID", 400);
  }

  const reel = await Reel.findOne({
    _id: id,
    isActive: true,
  })
    .populate("author", "name avatar")
    .populate(
      "taggedProducts",
      "name price images isActive",
    );

  if (!reel) {
    throw new AppError("Reel not found", 404);
  }

  return res.status(200).json({
    success: true,
    reel,
  });
});

// Delete own reel
export const deleteReel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid reel ID", 400);
  }

  const reel = await Reel.findOne({
    _id: id,
    author: req.user._id,
    isActive: true,
  });

  if (!reel) {
    throw new AppError(
      "Reel not found or you do not own this reel",
      404,
    );
  }

  // Cloudinary failure aana DB record-ai delete panna vendam.
  await cloudinary.uploader.destroy(reel.videoPublicId, {
    resource_type: "video",
  });

  await Reel.deleteOne({ _id: reel._id });

  return res.status(200).json({
    success: true,
    message: "Reel deleted successfully",
  });
});



/* Admin: Get reels for moderation */
export const getAdminReels = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Number.parseInt(req.query.page, 10) || 1,
  );

  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
  );

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
      { caption: { $regex: escapedSearch, $options: "i" } },
      { author: { $in: matchingUsers.map((user) => user._id) } },
    ];
  }

  const [reels, total] = await Promise.all([
    Reel.find(filter)
      .populate("author", "name email avatar")
      .populate("taggedProducts", "name price images")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Reel.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    results: reels.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    reels,
  });
});

/* Admin: Deactivate or restore a reel */
export const updateAdminReelStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid reel ID", 400);
  }

  if (typeof isActive !== "boolean") {
    throw new AppError("isActive must be a boolean", 400);
  }

  const reel = await Reel.findByIdAndUpdate(
    id,
    { $set: { isActive } },
    { returnDocument: "after", runValidators: true },
  );

  if (!reel) {
    throw new AppError("Reel not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: `Reel ${isActive ? "restored" : "deactivated"} successfully`,
    reel,
  });
});
