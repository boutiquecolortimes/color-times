import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { createQrCode, deleteQrCode, listQrCodes } from "@/lib/whatsapp/meta-graph";

function fail(result: { error: string; status: number }) {
  return apiError(result.error, result.status >= 500 ? 502 : 400);
}

/** WhatsApp QR codes / wa.me short links with a pre-filled customer message. */
export async function GET(): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;
  const result = await listQrCodes();
  return result.ok ? apiSuccess({ qrCodes: result.data }) : fail(result);
}

const createSchema = z.object({
  prefilledMessage: z.string().trim().min(1, "Enter the message").max(140),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;
  try {
    const { prefilledMessage } = createSchema.parse(await request.json());
    const result = await createQrCode(prefilledMessage);
    return result.ok ? apiSuccess({ qrCode: result.data }, 201) : fail(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return apiError("code is required", 400);
  const result = await deleteQrCode(code);
  return result.ok ? apiSuccess({ deleted: true }) : fail(result);
}
