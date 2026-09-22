import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { BookingReview } from "@/models/BookingReview";
import "@/models/User";
import "@/models/Product";
import { siteConfig } from "@/lib/config/site";
import { BookingReviewForm } from "@/components/booking-review-form";

export const metadata: Metadata = {
  title: "Share Your Review",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await connectToDatabase();

  const booking = await Booking.findOne({ reviewToken: token })
    .populate("customer", "name")
    .populate("items.product", "name")
    .lean();

  if (!booking) {
    notFound();
  }

  const existingReview = await BookingReview.findOne({ booking: booking._id }).lean();

  const customerName = (booking.customer as unknown as { name?: string } | null)?.name ?? "";
  const itemNames = booking.items
    .map((item) => (item.product as unknown as { name?: string } | null)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden px-6 py-12">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gold)" }}
      />

      <div className="relative flex w-full flex-col items-center">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt={siteConfig.name}
            width={160}
            height={160}
            priority
            className="h-24 w-24 object-contain sm:h-28 sm:w-28"
          />
          <span className="font-heading text-xl tracking-wide">{siteConfig.name}</span>
        </div>

        <div className="mt-6 w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-xl shadow-black/[0.04] sm:p-8">
          {existingReview ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-heading text-2xl">Thank You!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your review for booking {booking.bookingNumber} has already been submitted.
                We appreciate you sharing your experience with us.
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-heading text-2xl">How was your experience?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Booking {booking.bookingNumber}
                {itemNames && ` · ${itemNames}`} — we&apos;d love to hear your feedback and see
                a few photos.
              </p>
              <BookingReviewForm token={token} defaultName={customerName} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
