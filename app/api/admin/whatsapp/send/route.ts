import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { NotificationLog } from "@/models/NotificationLog";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";
import { sendTemplate } from "@/lib/whatsapp/meta-graph";
import { recordOutboundMessage } from "@/lib/whatsapp/messages";

const sendSchema = z.object({
  to: z.string().trim().min(8, "Enter a phone number with country code"),
  recipientName: z.string().trim().max(120).optional(),
  templateName: z.string().trim().min(1),
  language: z.string().trim().min(2),
  headerText: z.array(z.string().trim().min(1, "Fill in the header value")).optional(),
  headerMedia: z
    .object({
      type: z.enum(["document", "image", "video"]),
      link: z.string().trim().url("Enter a public file URL"),
      filename: z.string().trim().optional(),
    })
    .optional(),
  bodyParams: z.array(z.string().trim().min(1, "Fill in every variable")).optional(),
  urlButtonParams: z
    .array(z.object({ index: z.number().int().min(0), text: z.string().trim().min(1) }))
    .optional(),
  // Rendered text the admin saw in the preview — stored in the log/inbox.
  previewText: z.string().max(4000),
});

/** Sends any approved Meta template to any number (manual / one-off sends). */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const input = sendSchema.parse(await request.json());
    const result = await sendTemplate(input);

    await connectToDatabase();
    await NotificationLog.create({
      channel: "whatsapp",
      recipientPhone: input.to,
      recipientName: input.recipientName || "Manual send",
      templateName: input.templateName,
      triggerEvent: "custom",
      message: input.previewText,
      status: result.ok ? "sent" : "failed",
      providerMessageId: result.ok ? result.data.messageId : undefined,
      errorMessage: result.ok ? undefined : result.error,
    });
    await recordOutboundMessage({
      waId: result.ok ? result.data.waId : undefined,
      phone: input.to,
      contactName: input.recipientName,
      waMessageId: result.ok ? result.data.messageId : undefined,
      type: "template",
      text: input.previewText,
      templateName: input.templateName,
      status: result.ok ? "sent" : "failed",
      errorMessage: result.ok ? undefined : result.error,
      sentBy: auth.user.sub,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, metaError: result.metaError ?? null },
        { status: 502 }
      );
    }
    return apiSuccess(result.data);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
