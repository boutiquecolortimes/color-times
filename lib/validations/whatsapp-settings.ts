import { z } from "zod";

export const WHATSAPP_PROVIDERS = ["brevo", "meta"] as const;
export type WhatsAppProvider = (typeof WHATSAPP_PROVIDERS)[number];

export const whatsAppSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(WHATSAPP_PROVIDERS),
  senderLabel: z.string().trim().max(60),
  autoSendOnBookingConfirmed: z.boolean(),
  autoSendOnBookingReturned: z.boolean(),
  autoSendOnBookingCancelled: z.boolean(),
  autoSendOnInvoiceSent: z.boolean(),
  autoSendOnPaymentReceived: z.boolean(),
  autoSendOnCustomisationBillSent: z.boolean(),
  autoSendOnSaleBillSent: z.boolean(),
});

export type WhatsAppSettingsInput = z.infer<typeof whatsAppSettingsSchema>;

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettingsInput = {
  enabled: false,
  provider: "brevo",
  senderLabel: "",
  autoSendOnBookingConfirmed: true,
  autoSendOnBookingReturned: true,
  autoSendOnBookingCancelled: true,
  autoSendOnInvoiceSent: true,
  autoSendOnPaymentReceived: true,
  autoSendOnCustomisationBillSent: true,
  autoSendOnSaleBillSent: true,
};
