
import express from "express";

import { protect } from "../middleware/authMiddleware.js";

import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cartController.js";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

router.route("/:productId")
  .patch(updateCartItem)
  .delete(removeCartItem);

export default router;
