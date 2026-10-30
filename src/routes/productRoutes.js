import express from "express";

import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";

import validateRequest from "../middleware/validateRequest.js";

import {
  createProductSchema,
  updateProductSchema,
} from "../validators/productValidator.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router
  .route("/")
  .get(getProducts)
  .post(
    protect,
    restrictTo("admin"),
    upload.array("images", 10),
    validateRequest(createProductSchema),
    createProduct,
  );

router
  .route("/:id")
  .get(getProductById)
  .patch(
    protect,
    restrictTo("admin"),
    upload.array("images", 10),
    validateRequest(updateProductSchema),
    updateProduct,
  )
  .delete(protect, restrictTo("admin"), deleteProduct);

export default router;
