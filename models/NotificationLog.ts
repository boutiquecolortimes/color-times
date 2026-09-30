import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import type { WhatsAppTriggerEvent } from "@/models/WhatsAppTemplate";

export type NotificationChannel = "whatsapp" | "email" | "sms" | "push";
// "delivered" / "read" are advanced by Meta webhook status callbacks.
export type NotificationStatus = "sent" | "delivered" | "read" | "failed";

export interface INotificationLog extends Document {
  channel: NotificationChannel;
  recipientPhone?: string;
  recipientName: string;
  templateId?: Types.ObjectId | null;
  templateName: string;
  triggerEvent: WhatsAppTriggerEvent | "test";
  message: string;
  status: NotificationStatus;
  providerMessageId?: string;
  errorMessage?: string;
  deliveredAt?: Date;
  readAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    channel: { type: String, enum: ["whatsapp", "email", "sms", "push"], required: true, index: true },
    recipientPhone: { type: String, trim: true },
    recipientName: { type: String, required: true, trim: true },
    templateId: { type: Schema.Types.ObjectId, ref: "WhatsAppTemplate", default: null },
    templateName: { type: String, required: true, trim: true },
    triggerEvent: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      required: true,
      index: true,
    },
    providerMessageId: { type: String, index: true },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    errorMessage: { type: String },
    relatedEntityType: { type: String },
    relatedEntityId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationLogSchema.index({ channel: 1, createdAt: -1 });

export const NotificationLog: Model<INotificationLog> =
  models.NotificationLog ?? model<INotificationLog>("NotificationLog", notificationLogSchema);
