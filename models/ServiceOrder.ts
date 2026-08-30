import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type ServiceType = "dry_clean" | "tailor";
export type ServiceOrderStatus = "pending" | "in_progress" | "quality_check" | "completed" | "cancelled";

export interface IServiceOrder extends Document {
  _id: Types.ObjectId;
  serviceType: ServiceType;
  product: Types.ObjectId;
  booking?: Types.ObjectId | null;
  // Free-text reference to a booking's manual bill number, for when a
  // service order is created directly from the Services page rather than
  // from a specific booking's detail page — there's no formal Booking link
  // in that case (see `booking` above), but staff can still note which
  // bill this dress's cleaning/alteration belongs to.
  bookingBillNumberRef?: string;
  description: string;
  status: ServiceOrderStatus;
  dryCleanCharge?: number;
  ironCharge?: number;
  stitchingCharge?: number;
  stitchingType?: string;
  otherCharge?: number;
  totalAmount: number;
  assignedTo?: string;
  sentDate: Date;
  expectedReturnDate: Date;
  completedDate?: Date | null;
  notes?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const serviceOrderSchema = new Schema<IServiceOrder>(
  {
    serviceType: { type: String, enum: ["dry_clean", "tailor"], required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    bookingBillNumberRef: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "quality_check", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    dryCleanCharge: { type: Number, min: 0 },
    ironCharge: { type: Number, min: 0 },
    stitchingCharge: { type: Number, min: 0 },
    stitchingType: { type: String, trim: true },
    otherCharge: { type: Number, min: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    assignedTo: { type: String, trim: true },
    sentDate: { type: Date, required: true },
    expectedReturnDate: { type: Date, required: true },
    completedDate: { type: Date, default: null },
    notes: { type: String, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

serviceOrderSchema.index({ status: 1, createdAt: -1 });

export const ServiceOrder: Model<IServiceOrder> =
  models.ServiceOrder ?? model<IServiceOrder>("ServiceOrder", serviceOrderSchema);
