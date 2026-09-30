import "server-only";
import type { Types } from "mongoose";
import { WhatsAppMessage, type WhatsAppMessageStatus } from "@/models/WhatsAppMessage";
import { normalizePhoneNumber } from "@/lib/notifications/meta-whatsapp";

/**
 * Writes an outbound message into the Inbox history. Never throws — a
 * logging failure must not turn a successful send into an error.
 */
export async function recordOutboundMessage(input: {
  waId?: string;
  phone: string;
  contactName?: string;
  waMessageId?: string;
  type: "text" | "template";
  text: string;
  templateName?: string;
  status: Extract<WhatsAppMessageStatus, "sent" | "failed">;
  errorMessage?: string;
  sentBy?: string | Types.ObjectId | null;
}): Promise<void> {
  try {
    await WhatsAppMessage.create({
      waMessageId: input.waMessageId,
      waId: input.waId || normalizePhoneNumber(input.phone),
      contactName: input.contactName,
      direction: "outbound",
      type: input.type,
      text: input.text,
      templateName: input.templateName,
      status: input.status,
      errorMessage: input.errorMessage,
      sentBy: input.sentBy ?? null,
      readByStaff: true,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to record outbound WhatsApp message:", error);
  }
}

const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

/** Webhook statuses can arrive out of order — never move a message backwards (read → delivered). */
export function isStatusUpgrade(current: string | undefined, next: string): boolean {
  if (next === "failed") return current !== "failed";
  return (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current ?? ""] ?? 0);
}
