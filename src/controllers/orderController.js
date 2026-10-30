import mongoose from "mongoose";

import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Create checkout order from the authenticated user's cart
export const checkout = asyncHandler(async (req, res) => {
  const { shippingAddress } = req.body;

  const requiredFields = [
    "fullName",
    "phone",
    "addressLine",
    "city",
    "state",
    "postalCode",
  ];

  if (
    !shippingAddress ||
    requiredFields.some(
      (field) =>
        typeof shippingAddress[field] !== "string" ||
        !shippingAddress[field].trim(),
    )
  ) {
    throw new AppError("Please provide a complete shipping address", 400);
  }

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart || cart.items.length === 0) {
    throw new AppError("Your cart is empty", 400);
  }

  const orderItems = [];
  let totalAmount = 0;

  for (const cartItem of cart.items) {
    const product = await Product.findOne({
      _id: cartItem.product,
      isActive: true,
    });

    if (!product) {
      throw new AppError(
        "A product in your cart is unavailable. Please update your cart.",
        400,
      );
    }

    if (product.stock < cartItem.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}`, 400);
    }

    const subtotal = product.price * cartItem.quantity;

    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images[0] || "",
      price: product.price,
      quantity: cartItem.quantity,
      subtotal,
    });

    totalAmount += subtotal;
  }

  // This creates a pending order. Payment is processed separately.
  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    totalAmount,
    shippingAddress: {
      fullName: shippingAddress.fullName.trim(),
      phone: shippingAddress.phone.trim(),
      addressLine: shippingAddress.addressLine.trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      postalCode: shippingAddress.postalCode.trim(),
    },
    paymentMethod: "demo",
    paymentStatus: "pending",
    orderStatus: "pending",
  });

  return res.status(201).json({
    success: true,
    message: "Checkout order created",
    order,
  });
});

// Get the authenticated user's orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({
    createdAt: -1,
  });

  return res.status(200).json({
    success: true,
    results: orders.length,
    orders,
  });
});

// Get one order belonging to the authenticated user
export const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return res.status(200).json({
    success: true,
    order,
  });
});

export const processDemoPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentResult } = req.body;

  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  if (!["success", "failure"].includes(paymentResult)) {
    throw new AppError("Invalid demo payment result", 400);
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.paymentStatus !== "pending") {
    throw new AppError("This order has already been processed", 400);
  }

  if (paymentResult === "failure") {
    order.paymentStatus = "failed";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Demo payment failed",
      order,
    });
  }

  // Reserve/decrement stock atomically for each order item.
  const decrementedProducts = [];

  try {
    for (const item of order.items) {
      const product = await Product.findOneAndUpdate(
        {
          _id: item.product,
          isActive: true,
          stock: { $gte: item.quantity },
        },
        { $inc: { stock: -item.quantity } },
        { returnDocument: "after" },
      );

      if (!product) {
        throw new AppError(`Insufficient stock for ${item.name}`, 409);
      }

      decrementedProducts.push({
        productId: item.product,
        quantity: item.quantity,
      });
    }

    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.paymentReference = `DEMO-${new mongoose.Types.ObjectId()}`;

    await order.save();

    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: [] } },
    );

    return res.status(200).json({
      success: true,
      message: "Demo payment successful. Order confirmed!",
      order,
    });
  } catch (error) {
    // Restore any stock already decremented if a later step fails.
    await Promise.all(
      decrementedProducts.map(({ productId, quantity }) =>
        Product.updateOne({ _id: productId }, { $inc: { stock: quantity } }),
      ),
    );

    throw error;
  }
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    results: orders.length,
    orders,
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;

  const allowedStatuses = [
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("Invalid order ID", 400);
  }

  if (!allowedStatuses.includes(orderStatus)) {
    throw new AppError("Invalid order status", 400);
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.paymentStatus !== "paid") {
    throw new AppError("Only paid orders can have their status updated", 400);
  }

  if (["delivered", "cancelled"].includes(order.orderStatus)) {
    throw new AppError("This order can no longer be updated", 400);
  }

  order.orderStatus = orderStatus;
  await order.save();

  res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    order,
  });
});
