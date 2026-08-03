import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { WhatsAppTemplate } from "@/models/WhatsAppTemplate";
import { NotificationLog } from "@/models/NotificationLog";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { sendWhatsAppMessage } from "@/lib/notifications/brevo-whatsapp";
import { sendMetaWhatsAppMessage } from "@/lib/notifications/meta-whatsapp";
import { DEFAULT_WHATSAPP_SETTINGS, type WhatsAppSettingsInput } from "@/lib/validations/whatsapp-settings";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const testMessageSchema = z.object({
  phone: z.string().trim().min(6, "Enter a valid phone number"),
  templateId: z.string().min(1, "Select a template"),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = testMessageSchema.parse(body);

    await connectToDatabase();

    const template = await WhatsAppTemplate.findById(input.templateId).lean();
    if (!template) {
      return apiError("Template not found", 404);
    }

    const settingsDoc = await Settings.findOne({ module: "whatsapp" }).lean();
    const settings = (settingsDoc?.data as WhatsAppSettingsInput) ?? DEFAULT_WHATSAPP_SETTINGS;

    let result: { success: boolean; messageId?: string; error?: string };
    if (settings.provider === "meta") {
      if (!template.metaTemplateName) {
        return apiError("This template has no Meta Template Name configured", 422);
      }
      result = await sendMetaWhatsAppMessage({
        to: input.phone,
        templateName: template.metaTemplateName,
        languageCode: template.metaLanguageCode || "en_US",
      });
    } else {
      if (!settings.senderLabel) {
        return apiError("Set your WhatsApp sender number in settings first", 422);
      }
      if (!template.brevoTemplateId) {
        return apiError("This template has no Brevo Template ID configured", 422);
      }
      result = await sendWhatsAppMessage({
        to: input.phone,
        senderNumber: settings.senderLabel,
        templateId: template.brevoTemplateId,
      });
    }

    await NotificationLog.create({
      channel: "whatsapp",
      recipientPhone: input.phone,
      recipientName: "Test recipient",
      templateId: template._id,
      templateName: template.name,
      triggerEvent: "test",
      message: template.previewBody,
      status: result.success ? "sent" : "failed",
      providerMessageId: result.messageId,
      errorMessage: result.error,
    });

    if (!result.success) {
      return apiError(result.error ?? "Failed to send test message", 502);
    }

    return apiSuccess({ messageId: result.messageId });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
