import { z } from "zod";
import { TRIGGER_EVENTS } from "@/lib/notifications/trigger-events";

export const whatsAppTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    triggerEvent: z.enum(TRIGGER_EVENTS),
    brevoTemplateId: z.number().int().min(0).optional(),
    metaTemplateName: z.string().trim().max(512).optional().or(z.literal("")),
    metaLanguageCode: z.string().trim().max(35).optional().or(z.literal("")),
    previewBody: z
      .string()
      .trim()
      .min(1, "Add a preview so staff know what this template says")
      .max(1000),
    isActive: z.boolean(),
  })
  .refine(
    (data) => Boolean(data.brevoTemplateId) || Boolean(data.metaTemplateName?.trim()),
    {
      message: "Enter a Brevo Template ID or a Meta Template Name",
      path: ["brevoTemplateId"],
    }
  );

export type WhatsAppTemplateInput = z.infer<typeof whatsAppTemplateSchema>;
