
import mongoose from "mongoose";

const reelLikeSchema = new mongoose.Schema(
  {
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

reelLikeSchema.index(
  { reel: 1, user: 1 },
  { unique: true },
);

const ReelLike = mongoose.model("ReelLike", reelLikeSchema);

export default ReelLike;
