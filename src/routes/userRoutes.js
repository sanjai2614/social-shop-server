import express from "express";

// controllers
import {
  getUserProfile,
  updateProfile,
  changePassword,
  searchUsers,
  uploadAvatar,
  getAdminUsers,
  updateCustomerStatus
} from "../controllers/userController.js";
import { getSavedPosts } from "../controllers/savedPostController.js";
import { followUser, unfollowUser ,getFollowers,getFollowing} from "../controllers/followController.js";

// middleware
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";

// validation
import {
  updateProfileSchema,
  changePasswordSchema,
} from "../validators/userValidator.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router
  .route("/me")
  .patch(protect, validateRequest(updateProfileSchema), updateProfile);

// Upload profile avatar
router
  .route("/me/avatar")
  .patch(protect, upload.single("avatar"), uploadAvatar);  

router
  .route("/me/password")
  .patch(protect, validateRequest(changePasswordSchema), changePassword);

// user saved post
router.route("/saved-posts").get(protect, getSavedPosts);

// search users
router.route("/search").get(protect, searchUsers);

// admin routes
router
  .route("/admin")
  .get(protect, restrictTo("admin"), getAdminUsers);

router
  .route("/admin/:id/status")
  .patch(protect, restrictTo("admin"), updateCustomerStatus);


// follow
router
  .route("/:id/follow")
  .put(protect, followUser)
  .delete(protect, unfollowUser);

// get followers
router
  .route("/:id/followers")
  .get(getFollowers);

// get following
router
  .route("/:id/following")
  .get(getFollowing);

// get profile
router.route("/:id").get(protect, getUserProfile);

export default router;
