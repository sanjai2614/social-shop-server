import mongoose from "mongoose";

const savedPostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
  },
  { timestamps: true },
);

// Same user same post-a duplicate-ah save panna mudiyadhu
savedPostSchema.index({ user: 1, post: 1 }, { unique: true });

// User-oda saved posts latest first retrieve panna
savedPostSchema.index({ user: 1, createdAt: -1 });

const SavedPost = mongoose.model("SavedPost", savedPostSchema);

export default SavedPost;
