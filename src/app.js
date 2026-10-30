import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";

import AppError from "./utils/AppError.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reelRoutes from "./routes/reelRoutes.js";

const app = express();

// Global middleware

app.use(
  cors({
    origin: [env.CLIENT_URL],
    credentials: true,
    
  }),
);

app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Social Shopping API is running",
  });
});

// API routes
app.use("/v1/auth", authRoutes);
app.use("/v1/users", userRoutes);
app.use("/v1/categories", categoryRoutes);
app.use("/v1/products", productRoutes);
app.use("/v1/posts", postRoutes);
app.use("/v1/comments", commentRoutes);
app.use("/v1/notifications", notificationRoutes);
app.use("/v1/cart", cartRoutes);
app.use("/v1/orders", orderRoutes);
app.use("/v1/dashboard", dashboardRoutes);
app.use("/v1/reels", reelRoutes);

// Unknown routes
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
});

// Error handler - always last
app.use(errorMiddleware);

export default app;
