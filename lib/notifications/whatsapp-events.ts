import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { WhatsAppTemplate, type WhatsAppTriggerEvent } from "@/models/WhatsAppTemplate";
import { NotificationLog } from "@/models/NotificationLog";
import { sendWhatsAppMessage } from "@/lib/notifications/brevo-whatsapp";
import { sendMetaWhatsAppMessage } from "@/lib/notifications/meta-whatsapp";
import { renderTemplate } from "@/lib/notifications/render-template";
import { TRIGGER_EVENT_VARIABLES } from "@/lib/notifications/trigger-events";
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
  // Public URL Meta's servers can fetch (bill/invoice/booking-confirmation
  // PDF) — only used when the active template for this trigger event has
  // metaHeaderType "document". Sending that kind of template without this
  // is what previously made real/test sends fail even though a manual
  // Graph API call with a header attached by hand worked fine.
  documentUrl?: string;
  documentFilename?: string;
}

async function sendTemplatedNotification(
  triggerEvent: WhatsAppTriggerEvent,
  settings: WhatsAppSettingsInput,
  context: NotifyContext
): Promise<void> {
  try {
    const template = await WhatsAppTemplate.findOne({ triggerEvent, isActive: true }).lean();
    if (!template) return;

    const allVariables: Record<string, string> = {
      customerName: context.customerName,
      ...context.variables,
    };
    const renderedPreview = renderTemplate(template.previewBody, allVariables);
    // Meta templates use positional {{1}}, {{2}}, ... placeholders, not the
    // named {{customerName}}-style ones used in the staff-facing preview —
    // TRIGGER_EVENT_VARIABLES is the source of truth for which value goes
    // in which position (it's also what the templates reference doc was
    // generated from, so it matches what's actually approved in Meta).
    const orderedParameters = (TRIGGER_EVENT_VARIABLES[triggerEvent] ?? ["customerName"]).map(
      (key) => allVariables[key] ?? ""
    );

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

    const headerType = template.metaHeaderType ?? "none";
    // Fail fast with a clear reason instead of letting Meta reject the whole
    // message — a template that needs a document header but has no URL to
    // send is a config gap (or a missing PDF generator), not a transient
    // send error.
    const missingRequiredDocument = headerType === "document" && !context.documentUrl;

    const result: { success: boolean; messageId?: string; error?: string } = missingRequiredDocument
      ? {
          success: false,
          error:
            "This template requires a document header (PDF), but no document URL was available for this event.",
        }
      : settings.provider === "meta"
        ? template.metaTemplateName
          ? await sendMetaWhatsAppMessage({
              to: context.customerPhone,
              templateName: template.metaTemplateName,
              languageCode: template.metaLanguageCode || "en_US",
              parameters: orderedParameters,
              headerDocument:
                headerType === "document"
                  ? { link: context.documentUrl!, filename: context.documentFilename }
                  : undefined,
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
  const settings = (settingsDoc?.data as WhatsAppSettingsInput) ?? DEFAULT_WHATSAPP_SETTINGS;
  // Meta Cloud API is the only provider wired up in the admin UI — force it
  // here too so a settings document saved back when Brevo was still
  // selectable doesn't silently route real auto-notifications through
  // Brevo again.
  return { ...settings, provider: "meta" };
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
