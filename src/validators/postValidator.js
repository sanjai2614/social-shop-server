
import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const createPostSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(2000, "Post cannot exceed 2000 characters")
      .optional()
      .default(""),

    taggedProducts: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (!value) return [];

        try {
          const parsed = JSON.parse(value);

          if (!Array.isArray(parsed)) {
            ctx.addIssue({
              code: "custom",
              message: "Tagged products must be an array",
            });
            return z.NEVER;
          }

          return parsed;
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "Invalid tagged products format",
          });
          return z.NEVER;
        }
      })
      .pipe(
        z.array(objectIdSchema).max(
          10,
          "Maximum 10 tagged products allowed",
        ),
      ),
  })
  .refine(
    (data) =>
      data.content.length > 0 ||
      // Image files are validated separately in controller.
      true,
    {
      message: "A post must contain text or at least one image",
    },
  );


export const updatePostSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(2000, "Post cannot exceed 2000 characters")
      .optional(),

    images: z
      .array(z.string().trim().url("Enter a valid image URL"))
      .max(10, "Maximum 10 images allowed")
      .optional(),

    taggedProducts: z
      .array(objectIdSchema)
      .max(10, "Maximum 10 tagged products allowed")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  })
  .refine(
    (data) =>
      data.content === undefined ||
      data.content.length > 0 ||
      (data.images !== undefined && data.images.length > 0),
    {
      message: "A post must contain text or at least one image",
    },
  );
