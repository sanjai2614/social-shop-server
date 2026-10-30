import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js"; // Correct relative path-a use pannu

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export default cloudinary;