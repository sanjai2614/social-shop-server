
import express from "express";

import {
  createReel,
  getReels,
  getReelById,
  deleteReel,
    getAdminReels,
  updateAdminReelStatus,
} from "../controllers/reelController.js";

import {
  likeReel,
  unlikeReel,
  getReelComments,
  createReelComment,
  getAdminReelComments,
  updateAdminReelCommentStatus
} from "../controllers/reelInteractionController.js";


import { protect, restrictTo } from "../middleware/authMiddleware.js";
import uploadVideo from "../middleware/uploadVideo.js";
import { deleteReelComment } from "../controllers/reelInteractionController.js";

const router = express.Router();

// Admin routes for reels
router
  .route("/admin")
  .get(protect, restrictTo("admin"), getAdminReels);

router
  .route("/admin/:id/status")
  .patch(protect, restrictTo("admin"), updateAdminReelStatus);

// Admin routes for reel comments
  router
  .route("/admin/comments")
  .get(protect, restrictTo("admin"), getAdminReelComments);

router
  .route("/admin/comments/:id/status")
  .patch(protect, restrictTo("admin"), updateAdminReelCommentStatus);

router
  .route("/")
  .get(protect, getReels)
  .post(protect, uploadVideo.single("video"), createReel);
  

router
  .route("/:id")
  .get(getReelById)
  .delete(protect, deleteReel);

  
router
  .route("/:id/like")
  .put(protect, likeReel)
  .delete(protect, unlikeReel);

router
  .route("/:id/comments")
  .get(getReelComments)
  .post(protect, createReelComment);

  router
  .route("/:id/comments/:commentId")
  .delete(protect, deleteReelComment);

export default router;
