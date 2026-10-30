import express from "express";

import {
  register,
  login,
  refreshAccessToken,
  logout,
  getMe,
} from "../controllers/authController.js";

import validateRequest from "../middleware/validateRequest.js";
import { registerSchema, loginSchema } from "../validators/authValidator.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/register").post(validateRequest(registerSchema), register);

router.route("/login").post(validateRequest(loginSchema), login);

router.route("/refresh").post(refreshAccessToken);

router.route("/logout").post(logout);

router.route("/me").get(protect, getMe);

export default router;
