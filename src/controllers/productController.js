
import mongoose from "mongoose";

import Product from "../models/Product.js";
import Category from "../models/Category.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import uploadProductImages from "../utils/uploadProductImages.js";

// Get active products
export const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
  );

  const filter = { isActive: true };

  if (req.query.category) {
    if (!mongoose.isValidObjectId(req.query.category)) {
      throw new AppError("Invalid category ID", 400);
    }

    filter.category = req.query.category;
  }

  if (req.query.search?.trim()) {
    filter.$text = { $search: req.query.search.trim() };
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("createdBy", "name avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Product.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    count: products.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    products,
  });
});

// Get single product
export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid product ID", 400);
  }

  const product = await Product.findOne({
    _id: id,
    isActive: true,
  })
    .populate("category", "name slug")
    .populate("createdBy", "name avatar");

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return res.status(200).json({
    success: true,
    product,
  });
});

// Create product (admin only)
export const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, category, stock, images = [] } = req.body;

  const existingCategory = await Category.findOne({
    _id: category,
    isActive: true,
  });

  if (!existingCategory) {
    throw new AppError("Active category not found", 400);
  }

  // Upload selected files to Cloudinary
  const uploadedImages = await uploadProductImages(req.files || []);

  // Support existing image URLs + uploaded files
  const productImages = [...images, ...uploadedImages];

  const product = await Product.create({
    name,
    description,
    price,
    images: productImages,
    category,
    stock,
    createdBy: req.user._id,
  });

  return res.status(201).json({
    success: true,
    message: "Product created successfully",
    product,
  });
});

// Update product (admin only)
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid product ID", 400);
  }

  const product = await Product.findById(id);

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const allowedFields = [
    "name",
    "description",
    "price",
    "category",
    "stock",
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  // Validate category if it is being updated
  if (updates.category !== undefined) {
    const category = await Category.findOne({
      _id: updates.category,
      isActive: true,
    });

    if (!category) {
      throw new AppError("Active category not found", 400);
    }
  }

  // Existing image URLs that should remain
 // Existing image URLs that should remain
let existingImages = product.images;

if (req.body.existingImages !== undefined) {
  existingImages = req.body.existingImages;

  if (!Array.isArray(existingImages)) {
    throw new AppError(
      "existingImages must be a JSON array",
      400,
    );
  }

  const invalidImage = existingImages.some(
    (url) =>
      typeof url !== "string" ||
      !product.images.includes(url),
  );

  if (invalidImage) {
    throw new AppError(
      "Invalid existing product image",
      400,
    );
  }
}


// Upload new images, if any
const uploadedImages = await uploadProductImages(
  req.files || [],
);

updates.images = [...existingImages, ...uploadedImages];

  product.set(updates);
  await product.save();

  await product.populate([
    { path: "category", select: "name slug" },
    { path: "createdBy", select: "name avatar" },
  ]);

  return res.status(200).json({
    success: true,
    message: "Product updated successfully",
    product,
  });
});

// Delete product (soft delete)
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid product ID", 400);
  }

  const product = await Product.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { returnDocument:'after' }
  );

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Product deactivated successfully",
  });
});


// Upload a single product image
// export const uploadProductImage = asyncHandler(async (req, res) => {
//   if (!req.file) {
//     throw new AppError("Please select an image", 400);
//   }

//   const [imageUrl] = await uploadProductImages([req.file]);

//   return res.status(200).json({
//     success: true,
//     imageUrl,
//   });
// });