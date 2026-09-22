import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { BookingReview } from "@/models/BookingReview";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "10")));
    const ratingParam = searchParams.get("rating");
    const search = searchParams.get("search")?.trim();

    const filter: Record<string, unknown> = {};

    if (ratingParam && ratingParam !== "all") {
      const rating = Number(ratingParam);
      if (rating >= 1 && rating <= 5) {
        filter.rating = rating;
      }
    }

    if (search) {
      // Booking numbers live on the Booking doc, not on BookingReview
      // itself, so a search that looks like one needs a separate lookup
      // before it can be folded into the same $or.
      const matchingBookings = await Booking.find({
        bookingNumber: { $regex: search, $options: "i" },
      })
        .select("_id")
        .lean();

      filter.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { comment: { $regex: search, $options: "i" } },
        ...(matchingBookings.length > 0
          ? [{ booking: { $in: matchingBookings.map((b) => b._id) } }]
          : []),
      ];
    }

    const [reviews, total] = await Promise.all([
      BookingReview.find(filter)
        .populate("booking", "bookingNumber status")
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      BookingReview.countDocuments(filter),
    ]);

    return apiSuccess({
      reviews: reviews.map((review) => ({
        _id: String(review._id),
        customerName: review.customerName,
        rating: review.rating,
        comment: review.comment,
        images: review.images,
        createdAt: review.createdAt,
        booking: review.booking
          ? {
              _id: String((review.booking as unknown as { _id: unknown })._id),
              bookingNumber: (review.booking as unknown as { bookingNumber: string })
                .bookingNumber,
            }
          : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
