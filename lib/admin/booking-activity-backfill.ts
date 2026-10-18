import { Booking } from "@/models/Booking";

// Bookings saved before statusUpdatedAt existed don't have it stored, and
// Mongo sorts a missing field below every real date — so without this they'd
// all sink to the bottom of the "latest activity" list. Fill them once per
// server process with the best timestamp we have (last update, else
// creation). Uses the native driver so the pipeline update runs as-is and
// doesn't bump updatedAt. After the first run this is a single indexed no-op.
let backfillPromise: Promise<void> | null = null;

export function ensureBookingStatusUpdatedAt(): Promise<void> {
  if (!backfillPromise) {
    backfillPromise = Booking.collection
      .updateMany({ statusUpdatedAt: { $exists: false } }, [
        { $set: { statusUpdatedAt: { $ifNull: ["$updatedAt", "$createdAt"] } } },
      ])
      .then(() => undefined)
      .catch((error) => {
        // Don't block the list on this — retry on the next request.
        backfillPromise = null;
        console.error("Booking statusUpdatedAt backfill failed", error);
      });
  }
  return backfillPromise;
}
