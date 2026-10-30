import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      trim: true,
      maxlength: [2000, "Post cannot exceed 2000 characters"],
      default: "",
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: (images) => images.every((image) => image.trim().length > 0),
        message: "Image URLs cannot be empty",
      },
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    taggedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true },
);

postSchema.index({ author: 1, createdAt: -1 });

postSchema.pre("validate", function () {
  if (!this.content?.trim() && this.images.length === 0) {
    this.invalidate(
      "content",
      "A post must contain text or at least one image",
    );
  }
});

const Post = mongoose.model("Post", postSchema);

export default Post;
