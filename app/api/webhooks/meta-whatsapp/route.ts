import { NextRequest, NextResponse, after } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { NotificationLog } from "@/models/NotificationLog";
import { WhatsAppMessage } from "@/models/WhatsAppMessage";
import { WhatsAppTemplate } from "@/models/WhatsAppTemplate";
import { WhatsAppWebhookEvent, type WebhookEventKind } from "@/models/WhatsAppWebhookEvent";
import { verifyWebhookSignature } from "@/lib/whatsapp/meta-graph";
import { isStatusUpgrade } from "@/lib/whatsapp/messages";
import { MEDIA_MESSAGE_TYPES, storeMessageMedia } from "@/lib/whatsapp/media";

/** Records a webhook call for the admin Overview's "Webhook status" card. Never throws. */
async function logWebhookEvent(kind: WebhookEventKind, ok: boolean, summary: string): Promise<void> {
  try {
    await connectToDatabase();
    await WhatsAppWebhookEvent.create({ kind, ok, summary });
  } catch (error) {
    console.error("Failed to log WhatsApp webhook event:", error);
  }
}

/** Meta's one-time subscription handshake — echoes back hub.challenge once the verify token matches. */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && challenge && expected && token === expected) {
    await logWebhookEvent("verify", true, "Meta verified the callback URL");
    return new NextResponse(challenge, { status: 200 });
  }

  // Never log the token itself — only why it failed.
  const reason = !expected
    ? "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set on the server"
    : mode !== "subscribe" || !challenge
      ? "Request was not a Meta verification call"
      : "Verify token typed in Meta doesn't match META_WHATSAPP_WEBHOOK_VERIFY_TOKEN";
  if (mode || token) await logWebhookEvent("verify", false, reason);
  return new NextResponse("Forbidden", { status: 403 });
}

interface MetaStatusEntry {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
}

interface MetaInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  image?: { id: string; mime_type?: string; caption?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  document?: { id: string; mime_type?: string; caption?: string; filename?: string };
  sticker?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  reaction?: { message_id: string; emoji?: string };
  contacts?: { name?: { formatted_name?: string } }[];
}

interface MetaChangeValue {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: MetaInboundMessage[];
  statuses?: MetaStatusEntry[];
  // message_template_status_update field
  event?: string;
  message_template_id?: number | string;
  message_template_name?: string;
  reason?: string | null;
}

function describeInbound(message: MetaInboundMessage): {
  text: string;
  media?: { id?: string; mimeType?: string; caption?: string; filename?: string };
} {
  switch (message.type) {
    case "text":
      return { text: message.text?.body ?? "" };
    case "button":
      return { text: message.button?.text ?? message.button?.payload ?? "[Button]" };
    case "interactive":
      return {
        text:
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title ??
          "[Interactive reply]",
      };
    case "image":
    case "video":
    case "audio":
    case "sticker":
    case "document": {
      const media = message[message.type as "image"] as
        | { id: string; mime_type?: string; caption?: string; filename?: string }
        | undefined;
      // Shown in the chat list and as the bubble text when there's no caption.
      const label: Record<string, string> = {
        image: "📷 Photo",
        video: "🎥 Video",
        audio: "🎤 Voice message",
        sticker: "Sticker",
        document: `📄 ${media?.filename ?? "Document"}`,
      };
      return {
        text: media?.caption || label[message.type],
        media: {
          id: media?.id,
          mimeType: media?.mime_type,
          caption: media?.caption,
          filename: media?.filename,
        },
      };
    }
    case "location": {
      const loc = message.location;
      return {
        text: loc
          ? `📍 ${loc.name ?? ""} ${loc.address ?? ""} (${loc.latitude}, ${loc.longitude})`.trim()
          : "[Location]",
      };
    }
    case "reaction":
      return { text: `Reacted ${message.reaction?.emoji ?? ""}`.trim() };
    case "contacts":
      return { text: `[Contact] ${message.contacts?.[0]?.name?.formatted_name ?? ""}`.trim() };
    default:
      return { text: `[${message.type} message]` };
  }
}

async function handleStatuses(statuses: MetaStatusEntry[]): Promise<void> {
  for (const status of statuses) {
    const at = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
    const errorMessage =
      status.status === "failed"
        ? [status.errors?.[0]?.title, status.errors?.[0]?.error_data?.details]
            .filter(Boolean)
            .join(" — ") || "Delivery failed"
        : undefined;

    const log = await NotificationLog.findOne({ providerMessageId: status.id }).select("status");
    if (log && isStatusUpgrade(log.status, status.status)) {
      await NotificationLog.updateOne(
        { _id: log._id },
        {
          status: status.status,
          ...(status.status === "delivered" ? { deliveredAt: at } : {}),
          ...(status.status === "read" ? { readAt: at } : {}),
          ...(errorMessage ? { errorMessage } : {}),
        }
      );
    }

    const message = await WhatsAppMessage.findOne({ waMessageId: status.id }).select("status");
    if (message && isStatusUpgrade(message.status, status.status)) {
      await WhatsAppMessage.updateOne(
        { _id: message._id },
        { status: status.status, ...(errorMessage ? { errorMessage } : {}) }
      );
    }
  }
}

async function handleInbound(value: MetaChangeValue): Promise<void> {
  const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
  for (const message of value.messages ?? []) {
    const { text, media } = describeInbound(message);
    // upsert on the WhatsApp message id — Meta retries webhooks, so the
    // same message can arrive more than once.
    const result = await WhatsAppMessage.updateOne(
      { waMessageId: message.id },
      {
        $setOnInsert: {
          waMessageId: message.id,
          waId: message.from,
          contactName: names.get(message.from),
          direction: "inbound",
          type: message.type,
          text,
          media,
          status: "received",
          readByStaff: false,
          timestamp: new Date(Number(message.timestamp) * 1000),
        },
      },
      { upsert: true }
    );

    // New photo / video / voice note / document: copy the file from Meta into
    // our own storage so the Inbox can show it. Runs after the webhook has
    // replied to Meta (after()), so a slow download never delays the 200.
    if (
      result.upsertedId &&
      media?.id &&
      (MEDIA_MESSAGE_TYPES as readonly string[]).includes(message.type)
    ) {
      const messageId = String(result.upsertedId);
      after(async () => {
        await connectToDatabase();
        await storeMessageMedia(messageId);
      });
    }
  }
}

async function handleTemplateStatus(value: MetaChangeValue): Promise<void> {
  if (!value.message_template_id || !value.event) return;
  const reason = value.reason && value.reason !== "NONE" ? ` (${value.reason})` : "";
  await WhatsAppTemplate.updateMany(
    { metaTemplateId: String(value.message_template_id) },
    { metaStatus: `${value.event}${reason}` }
  );
}

/**
 * Everything Meta pushes for this WABA: delivery statuses (sent → delivered
 * → read / failed), incoming customer messages for the Inbox, and template
 * approval / rejection updates.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    await logWebhookEvent(
      "rejected",
      false,
      "Signature check failed — META_APP_SECRET doesn't match your Meta app's App secret"
    );
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
    const changes: { field?: string; value?: MetaChangeValue }[] = (body?.entry ?? []).flatMap(
      (entry: { changes?: unknown[] }) => entry.changes ?? []
    );

    let messages = 0;
    let statuses = 0;
    let templateUpdates = 0;
    if (changes.length > 0) {
      await connectToDatabase();
      for (const change of changes) {
        messages += change.value?.messages?.length ?? 0;
        statuses += change.value?.statuses?.length ?? 0;
        if (change.field === "message_template_status_update") templateUpdates += 1;
        const value = change.value ?? {};
        if (change.field === "message_template_status_update") {
          await handleTemplateStatus(value);
          continue;
        }
        if (value.statuses?.length) await handleStatuses(value.statuses);
        if (value.messages?.length) await handleInbound(value);
      }
    }
    const parts = [
      messages && `${messages} incoming message${messages > 1 ? "s" : ""}`,
      statuses && `${statuses} delivery status${statuses > 1 ? "es" : ""}`,
      templateUpdates && `${templateUpdates} template update${templateUpdates > 1 ? "s" : ""}`,
    ].filter(Boolean);
    await logWebhookEvent(
      "event",
      true,
      parts.length ? `Received ${parts.join(", ")}` : `Received ${changes.map((c) => c.field).join(", ") || "an empty event"}`
    );
  } catch (error) {
    // Meta expects a 200 regardless — errors here must never surface as a webhook failure.
    console.error("Meta WhatsApp webhook processing error:", error);
    await logWebhookEvent(
      "event",
      false,
      `Received a call but couldn't process it: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  return NextResponse.json({ received: true });
}
