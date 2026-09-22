import type { Metadata } from "next";
import { Star } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { BookingReview } from "@/models/BookingReview";
import { ReviewsClient } from "@/components/admin/reviews-client";

export const metadata: Metadata = { title: "Reviews" };

export default async function AdminReviewsPage() {
  await connectToDatabase();

  const [totalReviews, ratingAgg, fiveStarCount] = await Promise.all([
    BookingReview.countDocuments(),
    BookingReview.aggregate<{ _id: null; avg: number }>([
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]),
    BookingReview.countDocuments({ rating: 5 }),
  ]);

  const averageRating = ratingAgg[0]?.avg ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customer reviews and photos submitted after a booking is returned.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Star className="h-6 w-6 fill-current" />
        </div>
        <div className="flex flex-1 flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Total Reviews</p>
            <p className="mt-0.5 font-heading text-xl">{totalReviews}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Average Rating</p>
            <p className="mt-0.5 font-heading text-xl">
              {totalReviews > 0 ? averageRating.toFixed(1) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">5-Star Reviews</p>
            <p className="mt-0.5 font-heading text-xl">{fiveStarCount}</p>
          </div>
        </div>
      </div>

      <ReviewsClient />
    </div>
  );
}
