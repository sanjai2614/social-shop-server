import { Readable } from "node:stream";
import cloudinary from "../config/cloudinary.js";

const uploadImage = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "social-shopping/products",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );

    Readable.from(buffer).pipe(stream);
  });

const uploadProductImages = async (files = []) => {
  if (!files.length) return [];

  return Promise.all(files.map((file) => uploadImage(file.buffer)));
};

export default uploadProductImages;