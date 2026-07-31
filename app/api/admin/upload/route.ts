import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_DIMENSION = 2000;

async function optimizeImage(buffer: Buffer, contentType: string): Promise<Buffer> {
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

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return apiError(
      "BLOB_READ_WRITE_TOKEN is not set. Add it to .env.local before uploading images.",
      500
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("No file provided", 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError("Only JPEG, PNG, WebP, or AVIF images are allowed", 415);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError("Image must be smaller than 8MB", 413);
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const optimizedBuffer = await optimizeImage(inputBuffer, file.type);

    // sharp's output buffers are small enough to come out of Node's shared
    // internal buffer pool, which backs them with a SharedArrayBuffer under
    // the hood. Vercel Blob's put() sends this as a fetch request body, and
    // undici (Node/Next's fetch implementation) refuses to send a body
    // backed by SharedArrayBuffer — it throws "ArrayBuffer: SharedArrayBuffer
    // is not allowed." Copying into a fresh, non-pooled buffer avoids it.
    const uploadBuffer = Buffer.from(optimizedBuffer);

    const blob = await put(`products/${Date.now()}-${file.name}`, uploadBuffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return apiSuccess({ url: blob.url }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
