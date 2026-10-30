import express from "express";

import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/categoryValidator.js";

const router = express.Router();

router
  .route("/")
  .get(getCategories)
  .post(
    protect,
    restrictTo("admin"),
    validateRequest(createCategorySchema),
    createCategory,
  );

router
  .route("/:id")
  .patch(
    protect,
    restrictTo("admin"),
    validateRequest(updateCategorySchema),
    updateCategory,
  )
  .delete(protect, restrictTo("admin"), deleteCategory);

export default router;
