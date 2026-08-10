import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, SETTINGS_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import {
  paymentMethodsSettingsSchema,
  DEFAULT_PAYMENT_METHODS,
} from "@/lib/validations/payment-methods";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

const MODULE_KEY = "payment-methods";

export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();
  const settings = await Settings.findOne({ module: MODULE_KEY }).lean();

  return apiSuccess({ settings: settings?.data ?? DEFAULT_PAYMENT_METHODS });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = paymentMethodsSettingsSchema.parse(body);

    await connectToDatabase();

    const before = await Settings.findOne({ module: MODULE_KEY }).lean();
    const settings = await Settings.findOneAndUpdate(
      { module: MODULE_KEY },
      { data: input, updatedBy: auth.user.sub },
      { upsert: true, returnDocument: "after" }
    );

    const changes = diffObjects(
      (before?.data as Record<string, unknown>) ?? DEFAULT_PAYMENT_METHODS,
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
