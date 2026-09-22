import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  optimizeImage,
  toUploadableBuffer,
} from "@/lib/media/optimize-image";

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

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return apiError("Only JPEG, PNG, WebP, or AVIF images are allowed", 415);
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return apiError("Image must be smaller than 8MB", 413);
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const optimizedBuffer = await optimizeImage(inputBuffer, file.type);
    const uploadBuffer = toUploadableBuffer(optimizedBuffer);

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
