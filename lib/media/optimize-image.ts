import "server-only";
import sharp from "sharp";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 2000;

/** Resizes/re-encodes an uploaded image so it never exceeds MAX_DIMENSION on
 * either side, shared by every route that accepts image uploads (admin
 * product photos, customer review photos, ...). */
export async function optimizeImage(buffer: Buffer, contentType: string): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const needsResize =
    (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION;

  // PNG is lossless — re-encoding one that's already within bounds can bloat it
  // (no palette quantization here), so only touch it when a resize is actually needed.
  if (contentType === "image/png" && !needsResize) {
    return buffer;
  }

  const image = sharp(buffer)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

  switch (contentType) {
    case "image/jpeg":
      return image.jpeg({ quality: 82 }).toBuffer();
    case "image/png":
      return image.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp":
      return image.webp({ quality: 82 }).toBuffer();
    case "image/avif":
      return image.avif({ quality: 60 }).toBuffer();
    default:
      return image.toBuffer();
  }
}

/**
 * sharp's output buffers are small enough to come out of Node's shared
 * internal buffer pool, which backs them with a SharedArrayBuffer under the
 * hood. Vercel Blob's put() sends this as a fetch request body, and undici
 * (Node/Next's fetch implementation) refuses to send a body backed by
 * SharedArrayBuffer — it throws "ArrayBuffer: SharedArrayBuffer is not
 * allowed." Copying into a fresh, non-pooled buffer avoids it.
 */
export function toUploadableBuffer(buffer: Buffer): Buffer {
  return Buffer.from(buffer);
}
