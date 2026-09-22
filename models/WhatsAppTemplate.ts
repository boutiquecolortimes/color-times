import { Schema, model, models, type Document, type Model } from "mongoose";
import {
  TRIGGER_EVENTS,
  WHATSAPP_HEADER_TYPES,
  type WhatsAppTriggerEvent,
  type WhatsAppHeaderType,
} from "@/lib/notifications/trigger-events";

// Re-exported for convenience so existing server-side imports from this
// model path keep working. Client-reachable code (validations, form
// components) should import these straight from
// @/lib/notifications/trigger-events instead — see the comment there for
// why importing them as values from *this* file broke the build.
export type { WhatsAppTriggerEvent, WhatsAppHeaderType };
export { WHATSAPP_HEADER_TYPES };

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
