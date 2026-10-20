import { connectToDatabase } from "@/lib/db/connect";
import { nextSharedBillNumber } from "@/lib/admin/bill-number";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

/** Next suggested shared bill number (bookings, sales, customisation) — used by the mobile app's "New" forms. */
export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;
  try {
    await connectToDatabase();
    return apiSuccess({ billNumber: await nextSharedBillNumber() });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
