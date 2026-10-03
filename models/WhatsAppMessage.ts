import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

// One row per WhatsApp message in either direction — the source for the
// admin Inbox (conversations are grouped by waId). Inbound rows come from
// the Meta webhook; outbound rows are written whenever the app sends
// (auto-notifications, reminders, the Send tab and Inbox replies), and
// their status is advanced by webhook delivery callbacks.

export type WhatsAppMessageDirection = "inbound" | "outbound";
export type WhatsAppMessageStatus = "received" | "sent" | "delivered" | "read" | "failed";

export interface IWhatsAppMessage extends Document {
  waMessageId?: string;
  waId: string;
  contactName?: string;
  direction: WhatsAppMessageDirection;
  type: string;
  text?: string;
  media?: {
    id?: string;
    mimeType?: string;
    caption?: string;
    filename?: string;
    // Permanent copy in Vercel Blob (see lib/whatsapp/media.ts) — Meta's
    // own media links expire, so the Inbox shows this instead.
    url?: string;
    downloadUrl?: string;
    size?: number;
    storedAt?: Date;
    /** Why the copy failed (expired at Meta, too large, …). */
    error?: string;
  };
  templateName?: string;
  status: WhatsAppMessageStatus;
  errorMessage?: string;
  sentBy?: Types.ObjectId | null;
  readByStaff: boolean;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppMessageSchema = new Schema<IWhatsAppMessage>(
  {
    waMessageId: { type: String, index: { unique: true, sparse: true } },
    waId: { type: String, required: true, index: true },
    contactName: { type: String, trim: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    type: { type: String, required: true, default: "text" },
    text: { type: String },
    media: {
      id: String,
      mimeType: String,
      caption: String,
      filename: String,
      url: String,
      downloadUrl: String,
      size: Number,
      storedAt: Date,
      error: String,
    },
    templateName: { type: String },
    status: {
      type: String,
      enum: ["received", "sent", "delivered", "read", "failed"],
      required: true,
    },
    errorMessage: { type: String },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    readByStaff: { type: Boolean, default: false },
    timestamp: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

whatsAppMessageSchema.index({ waId: 1, timestamp: -1 });
whatsAppMessageSchema.index({ timestamp: -1 });

export const WhatsAppMessage: Model<IWhatsAppMessage> =
  models.WhatsAppMessage ?? model<IWhatsAppMessage>("WhatsAppMessage", whatsAppMessageSchema);
