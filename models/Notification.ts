import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type NotificationType =
  | "booking_confirmed"
  | "booking_returned"
  | "booking_cancelled"
  | "invoice_sent"
  | "payment_received"
  | "low_stock"
  | "service_ready"
  | "customisation_bill_sent"
  | "sale_bill_sent"
  | "customer_enquiry";

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "booking_confirmed",
        "booking_returned",
        "booking_cancelled",
        "invoice_sent",
        "payment_received",
        "low_stock",
        "service_ready",
        "customisation_bill_sent",
        "sale_bill_sent",
        "customer_enquiry",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    relatedEntityType: { type: String },
    relatedEntityId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

export const Notification: Model<INotification> =
  models.Notification ?? model<INotification>("Notification", notificationSchema);
