import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { WhatsAppMessage } from "@/models/WhatsAppMessage";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { markMessageRead, sendTextMessage } from "@/lib/whatsapp/meta-graph";
import { recordOutboundMessage } from "@/lib/whatsapp/messages";

interface RouteParams {
  params: Promise<{ waId: string }>;
}

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** One conversation's messages (oldest → newest); marks inbound ones read for staff and on WhatsApp. */
export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { waId } = await params;
    await connectToDatabase();

    const messages = await WhatsAppMessage.find({ waId })
      .sort({ timestamp: -1 })
      .limit(300)
      .populate("sentBy", "name")
      .lean();
    messages.reverse();

    const unread = messages.filter((m) => m.direction === "inbound" && !m.readByStaff);
    if (unread.length > 0) {
      await WhatsAppMessage.updateMany(
        { _id: { $in: unread.map((m) => m._id) } },
        { readByStaff: true }
      );
      // Blue ticks for the customer — marking the latest one marks all earlier ones too.
      const latest = unread[unread.length - 1];
      if (latest.waMessageId) void markMessageRead(latest.waMessageId);
    }

    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    const windowOpenUntil = lastInbound
      ? new Date(new Date(lastInbound.timestamp).getTime() + SERVICE_WINDOW_MS)
      : null;

    return apiSuccess({
      messages,
      windowOpenUntil,
      windowOpen: Boolean(windowOpenUntil && windowOpenUntil.getTime() > Date.now()),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

const replySchema = z.object({ text: z.string().trim().min(1, "Type a message").max(4096) });

/** Free-text reply — Meta only allows this within 24h of the customer's last message. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { waId } = await params;
    const { text } = replySchema.parse(await request.json());
    await connectToDatabase();

    const lastInbound = await WhatsAppMessage.findOne({ waId, direction: "inbound" })
      .sort({ timestamp: -1 })
      .select("timestamp contactName")
      .lean();
    if (!lastInbound || Date.now() - new Date(lastInbound.timestamp).getTime() > SERVICE_WINDOW_MS) {
      return apiError(
        "The 24-hour reply window is closed. Send an approved template instead (Send tab) — the customer can reply to reopen the chat.",
        422
      );
    }

    const result = await sendTextMessage(waId, text);
    await recordOutboundMessage({
      waId,
      phone: waId,
      contactName: lastInbound.contactName,
      waMessageId: result.ok ? result.data.messageId : undefined,
      type: "text",
      text,
      status: result.ok ? "sent" : "failed",
      errorMessage: result.ok ? undefined : result.error,
      sentBy: auth.user.sub,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    return apiSuccess(result.data);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
