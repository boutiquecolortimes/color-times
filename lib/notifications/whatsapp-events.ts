import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { WhatsAppTemplate, type WhatsAppTriggerEvent } from "@/models/WhatsAppTemplate";
import { NotificationLog } from "@/models/NotificationLog";
import { sendWhatsAppMessage } from "@/lib/notifications/brevo-whatsapp";
import { sendMetaWhatsAppMessage } from "@/lib/notifications/meta-whatsapp";
import { renderTemplate } from "@/lib/notifications/render-template";
import {
  DEFAULT_WHATSAPP_SETTINGS,
  type WhatsAppSettingsInput,
} from "@/lib/validations/whatsapp-settings";

const SETTINGS_MODULE = "whatsapp";

type AutoSendKey =
  | "autoSendOnBookingConfirmed"
  | "autoSendOnBookingReturned"
  | "autoSendOnBookingCancelled"
  | "autoSendOnInvoiceSent"
  | "autoSendOnPaymentReceived"
  | "autoSendOnCustomisationBillSent"
  | "autoSendOnSaleBillSent";

interface NotifyContext {
  customerName: string;
  customerPhone?: string;
  relatedEntityType: "Booking" | "Invoice" | "CustomisationOrder" | "Sale";
  relatedEntityId: string;
  variables: Record<string, string>;
}

async function sendTemplatedNotification(
  triggerEvent: WhatsAppTriggerEvent,
  settings: WhatsAppSettingsInput,
  context: NotifyContext
): Promise<void> {
  try {
    const template = await WhatsAppTemplate.findOne({ triggerEvent, isActive: true }).lean();
    if (!template) return;

    const renderedPreview = renderTemplate(template.previewBody, {
      customerName: context.customerName,
      ...context.variables,
    });

    if (!context.customerPhone) {
      await NotificationLog.create({
        channel: "whatsapp",
        recipientName: context.customerName,
        templateId: template._id,
        templateName: template.name,
        triggerEvent,
        message: renderedPreview,
        status: "failed",
        errorMessage: "Customer has no phone number on file",
        relatedEntityType: context.relatedEntityType,
        relatedEntityId: context.relatedEntityId,
      });
      return;
    }

    const result =
      settings.provider === "meta"
        ? template.metaTemplateName
          ? await sendMetaWhatsAppMessage({
              to: context.customerPhone,
              templateName: template.metaTemplateName,
              languageCode: template.metaLanguageCode || "en_US",
            })
          : { success: false, error: "Template has no Meta Template Name configured" }
        : template.brevoTemplateId
          ? await sendWhatsAppMessage({
              to: context.customerPhone,
              senderNumber: settings.senderLabel,
              templateId: template.brevoTemplateId,
            })
          : { success: false, error: "Template has no Brevo Template ID configured" };

    await NotificationLog.create({
      channel: "whatsapp",
      recipientPhone: context.customerPhone,
      recipientName: context.customerName,
      templateId: template._id,
      templateName: template.name,
      triggerEvent,
      message: renderedPreview,
      status: result.success ? "sent" : "failed",
      providerMessageId: result.messageId,
      errorMessage: result.error,
      relatedEntityType: context.relatedEntityType,
      relatedEntityId: context.relatedEntityId,
    });
  } catch {
    // Notifications must never break the calling request/route.
  }
}

async function loadSettings(): Promise<WhatsAppSettingsInput> {
  await connectToDatabase();
  const settingsDoc = await Settings.findOne({ module: SETTINGS_MODULE }).lean();
  return (settingsDoc?.data as WhatsAppSettingsInput) ?? DEFAULT_WHATSAPP_SETTINGS;
}

async function dispatchAutoWhatsAppEvent(
  triggerEvent: WhatsAppTriggerEvent,
  autoSendKey: AutoSendKey,
  context: NotifyContext
): Promise<void> {
  try {
    const settings = await loadSettings();
    if (!settings.enabled || !settings[autoSendKey]) return;
    await sendTemplatedNotification(triggerEvent, settings, context);
  } catch {
    // Notifications must never break the calling request/route.
  }
}

/** Manual, staff-initiated sends (reminders) — no per-event auto-send toggle, just the global on/off switch. */
async function dispatchManualWhatsAppEvent(
  triggerEvent: WhatsAppTriggerEvent,
  context: NotifyContext
): Promise<void> {
  try {
    const settings = await loadSettings();
    if (!settings.enabled) return;
    await sendTemplatedNotification(triggerEvent, settings, context);
  } catch {
    // Notifications must never break the calling request/route.
  }
}

export function notifyBookingConfirmed(context: NotifyContext): Promise<void> {
  return dispatchAutoWhatsAppEvent("booking_confirmed", "autoSendOnBookingConfirmed", context);
}

export function notifyBookingReturned(context: NotifyContext): Promise<void> {
  return dispatchAutoWhatsAppEvent("booking_returned", "autoSendOnBookingReturned", context);
}

export function notifyBookingCancelled(context: NotifyContext): Promise<void> {
  return dispatchAutoWhatsAppEvent("booking_cancelled", "autoSendOnBookingCancelled", context);
}

export function notifyInvoiceSent(context: NotifyContext): Promise<void> {
  return dispatchAutoWhatsAppEvent("invoice_sent", "autoSendOnInvoiceSent", context);
}

export function notifyPaymentReceived(context: NotifyContext): Promise<void> {
  return dispatchAutoWhatsAppEvent("payment_received", "autoSendOnPaymentReceived", context);
}

export function notifyBookingReminder(context: NotifyContext): Promise<void> {
  return dispatchManualWhatsAppEvent("booking_reminder", context);
}

export function notifyBookingReturnReminder(context: NotifyContext): Promise<void> {
  return dispatchManualWhatsAppEvent("booking_return_reminder", context);
}

export function notifyPaymentReminder(context: NotifyContext): Promise<void> {
  return dispatchManualWhatsAppEvent("payment_reminder", context);
}

export function notifyCustomisationBillSent(context: NotifyContext): Promise<void> {
  return dispatchAutoWhatsAppEvent(
    "customisation_bill_sent",
    "autoSendOnCustomisationBillSent",
    context
  );
}

export function notifySaleBillSent(context: NotifyContext): Promise<void> {
  return dispatchAutoWhatsAppEvent("sale_bill_sent", "autoSendOnSaleBillSent", context);
}
