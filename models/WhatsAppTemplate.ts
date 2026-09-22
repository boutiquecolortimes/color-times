import { Schema, model, models, type Document, type Model } from "mongoose";
import { TRIGGER_EVENTS, type WhatsAppTriggerEvent } from "@/lib/notifications/trigger-events";

export type { WhatsAppTriggerEvent };

// "document" means the approved Meta template starts with a HEADER component
// of format DOCUMENT (a bill/invoice/booking-confirmation PDF) — Meta
// rejects the send if that component is missing, even when the body
// parameters are otherwise correct. "none" means the template has no header
// at all (a plain TEXT header, if any, needs no runtime parameter).
export const WHATSAPP_HEADER_TYPES = ["none", "document"] as const;
export type WhatsAppHeaderType = (typeof WHATSAPP_HEADER_TYPES)[number];

export interface IWhatsAppTemplate extends Document {
  name: string;
  triggerEvent: WhatsAppTriggerEvent;
  brevoTemplateId?: number;
  metaTemplateName?: string;
  metaLanguageCode?: string;
  metaTemplateId?: string;
  metaStatus?: string;
  metaHeaderType: WhatsAppHeaderType;
  previewBody: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppTemplateSchema = new Schema<IWhatsAppTemplate>(
  {
    name: { type: String, required: true, trim: true },
    triggerEvent: {
      type: String,
      enum: TRIGGER_EVENTS,
      required: true,
      index: true,
    },
    brevoTemplateId: { type: Number },
    metaTemplateName: { type: String, trim: true },
    metaLanguageCode: { type: String, trim: true, default: "en_US" },
    metaTemplateId: { type: String, trim: true },
    metaStatus: { type: String, trim: true },
    metaHeaderType: { type: String, enum: WHATSAPP_HEADER_TYPES, default: "none" },
    previewBody: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const WhatsAppTemplate: Model<IWhatsAppTemplate> =
  models.WhatsAppTemplate ?? model<IWhatsAppTemplate>("WhatsAppTemplate", whatsAppTemplateSchema);
