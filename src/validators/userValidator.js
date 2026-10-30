import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .optional(),

    bio: z
      .string()
      .trim()
      .max(200, "Bio cannot exceed 200 characters")
      .optional(),

    avatar: z
      .union([z.string().trim().url("Enter a valid avatar URL"), z.literal("")])
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.bio !== undefined ||
      data.avatar !== undefined,
    { message: "Provide at least one field to update" },
  );

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),

    newPassword: z
      .string()
      .min(8, "New password must contain at least 8 characters")
      .max(72, "New password is too long"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "New password must be different from current password",
  });
