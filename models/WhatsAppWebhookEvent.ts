import { Schema, model, models, type Document, type Model } from "mongoose";

// A short trail of every call Meta makes to /api/webhooks/meta-whatsapp —
// the only reliable way to know the webhook is configured, since Meta
// doesn't expose an app's callback URL / subscribed fields to the WABA
// token. Rows expire after 7 days.

export type WebhookEventKind = "verify" | "event" | "rejected";

export interface IWhatsAppWebhookEvent extends Document {
  kind: WebhookEventKind;
  ok: boolean;
  summary: string;
  createdAt: Date;
}

const schema = new Schema<IWhatsAppWebhookEvent>(
  {
    kind: { type: String, enum: ["verify", "event", "rejected"], required: true },
    ok: { type: Boolean, required: true },
    summary: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
schema.index({ kind: 1, createdAt: -1 });

export const WhatsAppWebhookEvent: Model<IWhatsAppWebhookEvent> =
  models.WhatsAppWebhookEvent ??
  model<IWhatsAppWebhookEvent>("WhatsAppWebhookEvent", schema);
