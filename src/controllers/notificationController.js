import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Get logged-in user's notifications
export const getNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
  );

  const filter = { recipient: req.user._id };

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate("sender", "name avatar")
      .populate("post", "content images")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Notification.countDocuments(filter),

    Notification.countDocuments({
      ...filter,
      isRead: false,
    }),
  ]);

  res.status(200).json({
    success: true,
    results: notifications.length,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    unreadCount,
    data: { notifications },
  });
});

// Mark one notification as read
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid notification ID", 400);
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      recipient: req.user._id,
    },
    { $set: { isRead: true } },
    { returnDocument: 'after' },
  ).populate("sender", "name avatar");

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: { notification },
  });
});

// Mark all notifications as read
export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    {
      recipient: req.user._id,
      isRead: false,
    },
    { $set: { isRead: true } },
  );

  res.status(200).json({
    success: true,
    message: "All notifications marked as read",
    modifiedCount: result.modifiedCount,
  });
});
