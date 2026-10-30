import express from "express";
import { deleteComment, getAdminComments, updateAdminCommentStatus } from "../controllers/commentController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/:commentId").delete(protect, deleteComment);

// Admin routes
router.route("/admin").get(protect, restrictTo("admin"), getAdminComments);
router.route("/admin/:commentId/status").patch(protect, restrictTo("admin"), updateAdminCommentStatus);

export default router;
