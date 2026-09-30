import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { recordAuditLog } from "@/lib/audit/log";
import { updateBusinessProfile } from "@/lib/whatsapp/meta-graph";
import { BUSINESS_VERTICALS } from "@/lib/whatsapp/meta-types";

// Limits are Meta's own for the WhatsApp business profile.
const profileSchema = z.object({
  about: z.string().trim().min(1, "About is required").max(139),
  description: z.string().trim().max(512),
  address: z.string().trim().max(256),
  email: z.string().trim().email("Enter a valid email").max(128).or(z.literal("")),
  websites: z.array(z.string().trim().url("Enter a full URL, starting with https://")).max(2),
  vertical: z.enum(BUSINESS_VERTICALS),
});

export async function PATCH(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const input = profileSchema.parse(await request.json());
    const result = await updateBusinessProfile(input);
    if (!result.ok) return apiError(result.error, result.status >= 500 ? 502 : 400);

    await recordAuditLog({
      entityType: "WhatsAppBusinessProfile",
      entityId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "profile",
      action: "update",
      actor: auth.user,
      snapshot: input as unknown as Record<string, unknown>,
    });
    return apiSuccess({ updated: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
