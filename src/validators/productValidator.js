
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID");

const imageUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid image URL");

const existingImagesSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}, z.array(imageUrlSchema).max(10, "Maximum 10 images allowed"));

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must contain at least 2 characters")
    .max(120, "Product name cannot exceed 120 characters"),

  description: z
    .string()
    .trim()
    .min(10, "Description must contain at least 10 characters")
    .max(2000, "Description cannot exceed 2000 characters"),

  price: z.coerce
    .number()
    .positive("Price must be greater than zero"),

  // JSON requests can provide image URLs.
  // Multipart requests upload files through req.files.
  images: z
    .array(imageUrlSchema)
    .max(10, "Maximum 10 images allowed")
    .optional()
    .default([]),

  category: objectIdSchema,

  stock: z.coerce
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative"),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),

    description: z.string().trim().min(10).max(2000).optional(),

    price: z.coerce
      .number()
      .positive("Price must be greater than zero")
      .optional(),

    // Existing image URLs to retain during multipart updates
    existingImages: existingImagesSchema.optional(),

    // Support existing JSON requests with image URLs
    images: z
      .array(imageUrlSchema)
      .max(10, "Maximum 10 images allowed")
      .optional(),

    category: objectIdSchema.optional(),

    stock: z.coerce
      .number()
      .int("Stock must be a whole number")
      .min(0, "Stock cannot be negative")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });
