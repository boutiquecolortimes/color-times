import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { apiSuccess, apiError } from "@/lib/api/response";

/**
 * RevenueCat → server sync for the "Color Times Privé" subscription sold in
 * the mobile app (App Store + Google Play). The app logs in to RevenueCat with
 * the user's Mongo _id as app_user_id, so events map straight onto a User.
 *
 * Setup: RevenueCat dashboard → Integrations → Webhooks → URL
 *   https://<site>/api/webhooks/revenuecat
 * and Authorization header value = REVENUECAT_WEBHOOK_SECRET.
 */
const GRANTING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);
const REVOKING = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);
// CANCELLATION only turns off auto-renew — access continues until expiry,
// so it is treated as an informational update of the expiry date.

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[] | null;
}

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== secret) {
    return apiError("Unauthorized", 401);
  }

  const body = (await request.json().catch(() => null)) as { event?: RevenueCatEvent } | null;
  const event = body?.event;
  if (!event?.type) return apiError("Invalid payload", 400);

  const userId = [event.app_user_id, event.original_app_user_id].find(
    (id): id is string => typeof id === "string" && Types.ObjectId.isValid(id)
  );
  // Anonymous RevenueCat ids ($RCAnonymousID:...) aren't ours — acknowledge and skip.
  if (!userId) return apiSuccess({ ignored: true });

  await connectToDatabase();
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const plan = event.product_id?.toLowerCase().includes("year") ? "yearly" : "monthly";

  if (GRANTING.has(event.type) || event.type === "CANCELLATION" || event.type === "BILLING_ISSUE") {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "premium.isActive": true,
          "premium.plan": plan,
          "premium.productId": event.product_id,
          "premium.store": event.store,
          "premium.expiresAt": expiresAt,
          "premium.updatedAt": new Date(),
        },
      }
    );
  } else if (REVOKING.has(event.type)) {
    await User.updateOne(
      { _id: userId },
      { $set: { "premium.isActive": false, "premium.expiresAt": expiresAt, "premium.updatedAt": new Date() } }
    );
  }

  return apiSuccess({ received: true });
}
