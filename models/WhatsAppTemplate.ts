import { Schema, model, models, type Document, type Model } from "mongoose";
import { TRIGGER_EVENTS, type WhatsAppTriggerEvent } from "@/lib/notifications/trigger-events";

export type { WhatsAppTriggerEvent };

export interface IWhatsAppTemplate extends Document {
  name: string;
  triggerEvent: WhatsAppTriggerEvent;
  brevoTemplateId?: number;
  metaTemplateName?: string;
  metaLanguageCode?: string;
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
    previewBody: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const WhatsAppTemplate: Model<IWhatsAppTemplate> =
  models.WhatsAppTemplate ?? model<IWhatsAppTemplate>("WhatsAppTemplate", whatsAppTemplateSchema);
