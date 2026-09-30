import { connectToDatabase } from "@/lib/db/connect";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { recordAuditLog } from "@/lib/audit/log";
import { listMessageTemplates } from "@/lib/whatsapp/meta-graph";
import { syncTemplatesFromMeta } from "@/lib/whatsapp/template-sync";

/** Pulls every Meta template into the app's trigger mapping (new ones arrive inactive). */
export async function POST(): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const result = await listMessageTemplates();
    if (!result.ok) return apiError(result.error, result.status >= 500 ? 502 : 400);

    await connectToDatabase();
    const report = await syncTemplatesFromMeta(result.data);

    await recordAuditLog({
      entityType: "WhatsAppTemplate",
      entityId: "sync",
      action: "update",
      actor: auth.user,
      metadata: report as unknown as Record<string, unknown>,
    });
    return apiSuccess(report);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
