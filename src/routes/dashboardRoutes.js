
import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { getDashboardStats } from "../controllers/dashboardController.js";

const router = express.Router();

router.use(protect, restrictTo("admin"));

router.route("/stats").get(getDashboardStats);

export default router;
