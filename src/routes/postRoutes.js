import express from "express";

// posts
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  getAdminPosts,
  updateAdminPostStatus
} from "../controllers/postController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";

// like
import { likePost, unlikePost } from "../controllers/likeController.js";

// comment
import {
  createComment,
  getPostComments,
} from "../controllers/commentController.js";

// saved post
import {
  savePost,
  unsavePost,
} from "../controllers/savedPostController.js";

import {
  createPostSchema,
  updatePostSchema,
} from "../validators/postValidator.js";

import { createCommentSchema } from "../validators/commentValidator.js";
import upload from "../middleware/upload.js";

const router = express.Router();


router
  .route("/admin")
  .get(protect, restrictTo("admin"), getAdminPosts);

router
  .route("/admin/:id/status")
  .patch(protect, restrictTo("admin"), updateAdminPostStatus);

// Posts
router
  .route("/")
  .get(protect, getPosts)
  .post(
    protect,
    upload.array("images", 10),
    validateRequest(createPostSchema),
    createPost,
  );

// post by id  
router
  .route("/:id")
  .get(getPostById)
  .patch(protect, validateRequest(updatePostSchema), updatePost)
  .delete(protect, deletePost);

// like
router
  .route("/:id/like")
  .put(protect, likePost)
  .delete(protect, unlikePost);

// comment
router
  .route("/:id/comments")
  .get(getPostComments)
  .post(protect, validateRequest(createCommentSchema), createComment);

// saved post
router
  .route("/:id/save")
  .put(protect, savePost)
  .delete(protect, unsavePost);
export default router;
