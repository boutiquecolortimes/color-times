import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import {
  whatsAppSettingsSchema,
  DEFAULT_WHATSAPP_SETTINGS,
} from "@/lib/validations/whatsapp-settings";
import { isWhatsAppConfigured } from "@/lib/notifications/brevo-whatsapp";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

const MODULE_KEY = "whatsapp";

export async function GET(): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();
  const settings = await Settings.findOne({ module: MODULE_KEY }).lean();

  return apiSuccess({
    settings: settings?.data ?? DEFAULT_WHATSAPP_SETTINGS,
    isConfigured: isWhatsAppConfigured(),
  });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = whatsAppSettingsSchema.parse(body);
    // Meta Cloud API is the only provider wired up in the admin UI — force
    // it here too (not just hide the picker) so this route can never
    // persist "brevo" again, from this form or a stray direct API call.
    const input = { ...parsed, provider: "meta" as const };

    await connectToDatabase();

    const before = await Settings.findOne({ module: MODULE_KEY }).lean();
    const settings = await Settings.findOneAndUpdate(
      { module: MODULE_KEY },
      { data: input, updatedBy: auth.user.sub },
      { upsert: true, returnDocument: "after" }
    );

    const changes = diffObjects(
      (before?.data as Record<string, unknown>) ?? DEFAULT_WHATSAPP_SETTINGS,
      input
    );

    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "Settings",
        entityId: MODULE_KEY,
        action: "update",
        actor: auth.user,
        changes,
      });
    }

    return apiSuccess({ settings: settings?.data ?? input });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
