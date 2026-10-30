import express from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getNotifications);

router.route("/read-all").patch(markAllNotificationsAsRead);

router.route("/:id/read").patch(markNotificationAsRead);

export default router;
