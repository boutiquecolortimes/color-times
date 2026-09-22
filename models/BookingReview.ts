import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

// A customer-submitted review for one specific booking, collected through
// the public /review/[token] page linked from the "Request Review" WhatsApp
// message. Deliberately separate from the storefront `Review` model (which
// is tied to a logged-in customer account + product, and is what powers the
// public testimonials/product-review display) — this one is reachable by an
// unauthenticated link and always carries 1-4 photos.
export interface IBookingReview extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  customerName: string;
  rating: number;
  comment?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const bookingReviewSchema = new Schema<IBookingReview>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // one review per booking
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (images: string[]) => images.length >= 1 && images.length <= 4,
        message: "Upload between 1 and 4 photos.",
      },
    },
  },
  { timestamps: true }
);

export const BookingReview: Model<IBookingReview> =
  models.BookingReview ?? model<IBookingReview>("BookingReview", bookingReviewSchema);
