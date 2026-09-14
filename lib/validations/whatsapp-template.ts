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
    // brevoTemplateId alone still satisfies this for templates created back
    // when Brevo was wired up in the UI — the admin template form no longer
    // exposes that field, but existing Brevo-configured templates must stay
    // editable without being forced to also fill in a Meta template name.
    (data) => Boolean(data.brevoTemplateId) || Boolean(data.metaTemplateName?.trim()),
    {
      message: "Enter a Meta Template Name",
      path: ["metaTemplateName"],
    }
  );

export type WhatsAppTemplateInput = z.infer<typeof whatsAppTemplateSchema>;
