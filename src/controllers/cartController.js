
import mongoose from "mongoose";

import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Get the authenticated user's cart
export const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate({
    path: "items.product",
    select: "name price images stock isActive category",
    populate: {
      path: "category",
      select: "name slug",
    },
  });

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      items: [],
    });
  }

  const items = cart.items
    .filter((item) => item.product && item.product.isActive)
    .map((item) => ({
      product: item.product,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

  const totalItems = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const totalPrice = items.reduce(
    (total, item) => total + item.subtotal,
    0,
  );

  return res.status(200).json({
    success: true,
    cart: {
      _id: cart._id,
      items,
      totalItems,
      totalPrice,
    },
  });
});

// Add a product to the cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError("Quantity must be a positive integer", 400);
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new AppError("Product not found or inactive", 404);
  }

  if (product.stock < quantity) {
    throw new AppError("Insufficient product stock", 400);
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      items: [],
    });
  }

  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId,
  );

  if (existingItem) {
    const nextQuantity = existingItem.quantity + quantity;

    if (nextQuantity > product.stock) {
      throw new AppError("Requested quantity exceeds available stock", 400);
    }

    existingItem.quantity = nextQuantity;
  } else {
    cart.items.push({
      product: productId,
      quantity,
    });
  }

  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Product added to cart",
  });
});

// Update cart item quantity
export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!mongoose.isValidObjectId(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError("Quantity must be a positive integer", 400);
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  });

  if (!product) {
    throw new AppError("Product not found or inactive", 404);
  }

  if (quantity > product.stock) {
    throw new AppError("Requested quantity exceeds available stock", 400);
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    throw new AppError("Cart not found", 404);
  }

  const item = cart.items.find(
    (entry) => entry.product.toString() === productId,
  );

  if (!item) {
    throw new AppError("Product not found in cart", 404);
  }

  item.quantity = quantity;
  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Cart quantity updated",
  });
});

// Remove one product from the cart
export const removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.isValidObjectId(productId)) {
    throw new AppError("Invalid product ID", 400);
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    throw new AppError("Cart not found", 404);
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId,
  );

  if (itemIndex === -1) {
    throw new AppError("Product not found in cart", 404);
  }

  cart.items.splice(itemIndex, 1);
  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Product removed from cart",
  });
});

// Clear the cart
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return res.status(200).json({
      success: true,
      message: "Cart is already empty",
    });
  }

  cart.items = [];
  await cart.save();

  return res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
  });
});
