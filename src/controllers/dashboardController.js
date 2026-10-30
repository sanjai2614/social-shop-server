
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalProducts,
    totalCategories,
    totalCustomers,
    totalOrders,
    revenueResult,
    recentOrders,
    lowStockProducts,
    orderStatusSummary,
    monthlyRevenue,
  ] = await Promise.all([
    // Active products
    Product.countDocuments({ isActive: true }),

    // Active categories
    Category.countDocuments({ isActive: true }),

    // Active customer accounts
    User.countDocuments({
      role: "customer",
      isActive: true,
    }),

    // All orders
    Order.countDocuments(),

    // Revenue from successful payments only
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]),

    // Latest 5 orders
    Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    // Active products with low stock
    Product.find({
      isActive: true,
      stock: { $lte: 5 },
    })
      .select("name price stock images")
      .sort({ stock: 1 })
      .limit(5)
      .lean(),

    // Order count by status
    Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]),

    // Revenue for the last 6 calendar months
    Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: {
            $gte: new Date(
              new Date().getFullYear(),
              new Date().getMonth() - 5,
              1
            ),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  return res.status(200).json({
    success: true,
    stats: {
      totalProducts,
      totalCategories,
      totalCustomers,
      totalOrders,
      totalRevenue: revenueResult[0]?.total ?? 0,
    },
    recentOrders,
    lowStockProducts,
    orderStatusSummary: orderStatusSummary.map((item) => ({
      status: item._id,
      count: item.count,
    })),
    monthlyRevenue: monthlyRevenue.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      revenue: item.revenue,
    })),
  });
});
