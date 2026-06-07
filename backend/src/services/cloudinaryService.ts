/**
 * cloudinaryService.ts — Upload images to Cloudinary from memory buffer.
 *
 * Uses the Cloudinary Node.js SDK v2.
 * Configuration is read from environment variables:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * uploadImageBuffer(buffer, mimetype, publicId?) → { secure_url, public_id }
 * deleteImage(publicId) → void (best-effort cleanup)
 */

import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id:  string;
}

/**
 * Upload a Buffer to Cloudinary and return the persistent secure_url.
 * Throws on failure — caller must handle and not create the DB session.
 */
export async function uploadImageBuffer(
  buffer:   Buffer,
  mimetype: string,
  folder = "mirror-x-ai"
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const resourceType = mimetype.startsWith("image/") ? "image" : "raw";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        // Auto-format and quality for storage efficiency
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        if (!result) {
          reject(new Error("Cloudinary upload returned no result"));
          return;
        }
        resolve({
          secure_url: result.secure_url,
          public_id:  result.public_id,
        });
      }
    );

    // Pipe the buffer into the upload stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

/**
 * Delete an image from Cloudinary by public_id.
 * Best-effort — errors are logged but not re-thrown.
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`[cloudinary] Deleted image: ${publicId}`);
  } catch (err) {
    console.error(`[cloudinary] Failed to delete image ${publicId}:`, err);
  }
}
