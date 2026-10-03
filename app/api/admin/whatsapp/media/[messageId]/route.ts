import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { storeMessageMedia } from "@/lib/whatsapp/media";

interface RouteParams {
  params: Promise<{ messageId: string }>;
}

/**
 * Inbox "Load" button: copies a message's photo / file from Meta into our
 * storage now — for messages that arrived before automatic copying, or
 * whose automatic copy failed. Works while Meta still has the file (~30 days).
 */
export async function POST(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { messageId } = await params;
    await connectToDatabase();
    const result = await storeMessageMedia(messageId);
    if (!result) return apiError("This message has no media", 404);
    if (!result.ok) return apiError(result.error, 422);
    return apiSuccess({ url: result.url, downloadUrl: result.downloadUrl, mimeType: result.mimeType });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
