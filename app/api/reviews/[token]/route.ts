import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { BookingReview } from "@/models/BookingReview";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { bookingReviewSubmitSchema } from "@/lib/validations/booking-review";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  optimizeImage,
  toUploadableBuffer,
} from "@/lib/media/optimize-image";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 4;

// Public, unauthenticated endpoint — the review token itself (an
// unguessable 24-byte hex string) is the only access control, mirroring
// the /api/bookings/track pattern used for public order tracking.
export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return apiError("Uploads are not configured. Please contact the store.", 500);
  }

  try {
    const { token } = await params;
    await connectToDatabase();

    const booking = await Booking.findOne({ reviewToken: token });
    if (!booking) {
      return apiError("This review link is invalid or has expired", 404);
    }

    const existing = await BookingReview.findOne({ booking: booking._id });
    if (existing) {
      return apiError("A review has already been submitted for this booking", 409);
    }

    const formData = await request.formData();
    const parsed = bookingReviewSubmitSchema.parse({
      customerName: formData.get("customerName"),
      rating: formData.get("rating"),
      comment: formData.get("comment") || undefined,
    });

    const files = formData
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length < MIN_PHOTOS || files.length > MAX_PHOTOS) {
      return apiError(`Please upload between ${MIN_PHOTOS} and ${MAX_PHOTOS} photos`, 400);
    }

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return apiError("Only JPEG, PNG, WebP, or AVIF images are allowed", 415);
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return apiError("Each photo must be smaller than 8MB", 413);
      }
    }

    const images: string[] = [];
    for (const file of files) {
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      const optimizedBuffer = await optimizeImage(inputBuffer, file.type);
      const uploadBuffer = toUploadableBuffer(optimizedBuffer);
      const blob = await put(`reviews/${booking._id}-${Date.now()}-${file.name}`, uploadBuffer, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      });
      images.push(blob.url);
    }

    const review = await BookingReview.create({
      booking: booking._id,
      customerName: parsed.customerName,
      rating: parsed.rating,
      comment: parsed.comment || undefined,
      images,
    });

    return apiSuccess({ review: { _id: String(review._id) } }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
