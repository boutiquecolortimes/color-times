import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import { measurementsSchema, type MeasurementValues } from "@/models/shared/measurements";

export type BookingStatus =
  | "inquiry"
  | "pending_payment"
  | "confirmed"
  | "in_use"
  | "returned"
  | "cancelled";

export type ReturnCondition = "good" | "minor_damage" | "major_damage" | "missing_items";

export const RETURN_CONDITIONS: ReturnCondition[] = [
  "good",
  "minor_damage",
  "major_damage",
  "missing_items",
];

export interface BookingItem {
  product: Types.ObjectId;
  color: string;
  size: string;
  quantity: number;
  pricePerDay: number;
  rentalFee: number;
  // Who's actually wearing this specific dress, and their measurements —
  // lets one booking cover multiple people (e.g. 5 girls, 5 dresses), each
  // tracked against their own item instead of one shared measurement set.
  wearerName?: string;
  measurements?: MeasurementValues;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  bookingNumber: string;
  billNumber?: string;
  bookingDate: Date;
  customer: Types.ObjectId;
  items: BookingItem[];
  rentalStartDate: Date;
  rentalEndDate: Date;
  eventDate: Date;
  status: BookingStatus;
  securityDeposit: number;
  totalAmount: number;
  advancePaid: number;
  measurements?: MeasurementValues;
  deliveryAddress?: string;
  notes?: string;
  returnCondition?: ReturnCondition;
  returnNotes?: string;
  returnedAt?: Date | null;
  dryCleaningRequired?: boolean;
  stitchingRequired?: boolean;
  damageCharges?: number;
  pendingRentAmount?: number;
  depositRefundAmount?: number;
  depositRefunded?: boolean;
  finalSettlementAmount?: number;
  settledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookingItemSchema = new Schema<BookingItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    color: { type: String, trim: true, default: "" },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    pricePerDay: { type: Number, required: true, min: 0 },
    rentalFee: { type: Number, required: true, min: 0 },
    wearerName: { type: String, trim: true },
    measurements: { type: measurementsSchema, default: undefined },
  },
  { _id: false }
);

const bookingSchema = new Schema<IBooking>(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    // Manual/physical bill reference number, kept separate from the
    // system-generated bookingNumber above.
    billNumber: { type: String, trim: true },
    bookingDate: { type: Date, required: true, default: Date.now, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: {
      type: [bookingItemSchema],
      required: true,
      validate: {
        validator: (items: BookingItem[]) => items.length > 0,
        message: "A booking requires at least one item.",
      },
    },
    rentalStartDate: { type: Date, required: true, index: true },
    rentalEndDate: { type: Date, required: true, index: true },
    eventDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["inquiry", "pending_payment", "confirmed", "in_use", "returned", "cancelled"],
      default: "inquiry",
      index: true,
    },
    securityDeposit: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    advancePaid: { type: Number, required: true, min: 0, default: 0 },
    measurements: { type: measurementsSchema, default: undefined },
    deliveryAddress: { type: String, trim: true },
    notes: { type: String },
    returnCondition: { type: String, enum: RETURN_CONDITIONS },
    returnNotes: { type: String },
    returnedAt: { type: Date, default: null, index: true },
    dryCleaningRequired: { type: Boolean, default: false },
    stitchingRequired: { type: Boolean, default: false },
    damageCharges: { type: Number, min: 0, default: 0 },
    pendingRentAmount: { type: Number, min: 0, default: 0 },
    depositRefundAmount: { type: Number, min: 0, default: 0 },
    depositRefunded: { type: Boolean, default: false },
    finalSettlementAmount: { type: Number, default: 0 },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ status: 1, rentalEndDate: 1 });

export const Booking: Model<IBooking> =
  models.Booking ?? model<IBooking>("Booking", bookingSchema);
