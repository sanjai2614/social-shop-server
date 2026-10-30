
import "dotenv/config";
import mongoose from "mongoose";

import Post from "../models/Post.js";
import Comment from "../models/Comment.js";

const migratePostCommentStatus = async () => {
  try {
    if (!process.env.MONGO_URL) {
      throw new Error("MONGO_URL is missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URL);

    console.log("MongoDB connected");

    // Existing posts: active by default
    const postResult = await Post.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );

    // Existing comments: active by default
    const commentResult = await Comment.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );

    console.log("Migration completed successfully");
    console.log("Posts updated:", postResult.modifiedCount);
    console.log("Comments updated:", commentResult.modifiedCount);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

migratePostCommentStatus();
