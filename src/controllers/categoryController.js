import mongoose from "mongoose";

import Category from "../models/Category.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const createSlug = (name) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Get active categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .select("name slug description")
    .sort({ name: 1 });

  return res.status(200).json({
    success: true,
    count: categories.length,
    categories,
  });
});

// Create category
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const slug = createSlug(name);

  const existingCategory = await Category.findOne({
    $or: [{ name: { $regex: `^${name}$`, $options: "i" } }, { slug }],
  });

  if (existingCategory) {
    throw new AppError("Category already exists", 409);
  }

  const category = await Category.create({
    name,
    slug,
    description,
    createdBy: req.user._id,
  });

  return res.status(201).json({
    success: true,
    message: "Category created successfully",
    category,
  });
});

// Update category
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid category ID", 400);
  }

  const updates = {};

if (req.body.name !== undefined) {
  updates.name = req.body.name;
  updates.slug = createSlug(req.body.name);
}

if (req.body.description !== undefined) {
  updates.description = req.body.description;
}

  if (updates.name !== undefined) {
    updates.slug = createSlug(updates.name);

    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      $or: [
        { name: { $regex: `^${updates.name}$`, $options: "i" } },
        { slug: updates.slug },
      ],
    });

    if (existingCategory) {
      throw new AppError("Category name already exists", 409);
    }
  }

  const category = await Category.findByIdAndUpdate(
    id,
    { $set: updates },
    { returnDocument:'after', runValidators: true },
  );

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Category updated successfully",
    category,
  });
});

// Deactivate category
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid category ID", 400);
  }

  const category = await Category.findById(id);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  const linkedProducts = await Product.exists({ category: id });

  if (linkedProducts) {
    category.isActive = false;
    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category deactivated because products are linked to it",
    });
  }

  await Category.findByIdAndDelete(id);

  return res.status(200).json({
    success: true,
    message: "Category deleted successfully",
  });
});
