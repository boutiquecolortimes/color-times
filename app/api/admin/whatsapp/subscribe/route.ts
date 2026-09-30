import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError } from "@/lib/api/response";
import { subscribeApp } from "@/lib/whatsapp/meta-graph";

/** Subscribes this app to the WABA's webhooks (needed for the Inbox and delivery ticks). */
export async function POST(): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;
  const result = await subscribeApp();
  return result.ok ? apiSuccess(result.data) : apiError(result.error, result.status >= 500 ? 502 : 400);
}
