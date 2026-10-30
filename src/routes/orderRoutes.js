
import express from "express";

import { protect, restrictTo } from "../middleware/authMiddleware.js";

import {
  checkout,
  getMyOrders,
  getOrderById,
  processDemoPayment,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = express.Router();

router.use(protect);

router.route("/checkout").post(checkout);

router.route("/my-orders").get(getMyOrders);

router.route("/payment/demo").post(processDemoPayment);

router
  .route("/admin/all")
  .get(restrictTo("admin"), getAllOrders);

router
  .route("/admin/:orderId/status")
  .patch(restrictTo("admin"), updateOrderStatus);


router.route("/:orderId").get(getOrderById);

export default router;
