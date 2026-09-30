import { connectToDatabase } from "@/lib/db/connect";
import { NotificationLog } from "@/models/NotificationLog";
import { WhatsAppMessage } from "@/models/WhatsAppMessage";
import { WhatsAppWebhookEvent } from "@/models/WhatsAppWebhookEvent";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";
import {
  getBusinessProfile,
  getCommerceSettings,
  getMessagingAnalytics,
  getMetaConfigStatus,
  getPhoneNumberInfo,
  getSubscribedApps,
  getWabaInfo,
  listPhoneNumbers,
  type GraphResult,
} from "@/lib/whatsapp/meta-graph";

function unwrap<T>(result: GraphResult<T>): { data: T | null; error: string | null } {
  return result.ok ? { data: result.data, error: null } : { data: null, error: result.error };
}

/** Live account details from Meta + 30-day delivery stats from the app's own logs. */
export async function GET(): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const config = getMetaConfigStatus();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await connectToDatabase();
    const [
      phone,
      profile,
      waba,
      phoneNumbers,
      analytics,
      subscribedApps,
      commerce,
      statusCounts,
      unreadInbound,
      inbound30d,
      recentWebhookEvents,
      lastVerify,
      lastEvent,
      lastInbound,
    ] = await Promise.all([
      getPhoneNumberInfo(),
      getBusinessProfile(),
      getWabaInfo(),
      listPhoneNumbers(),
      getMessagingAnalytics(30),
      getSubscribedApps(),
      getCommerceSettings(),
      NotificationLog.aggregate<{ _id: string; count: number }>([
        { $match: { channel: "whatsapp", createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      WhatsAppMessage.countDocuments({ direction: "inbound", readByStaff: false }),
      WhatsAppMessage.countDocuments({ direction: "inbound", timestamp: { $gte: since } }),
      WhatsAppWebhookEvent.find().sort({ createdAt: -1 }).limit(15).lean(),
      WhatsAppWebhookEvent.findOne({ kind: "verify", ok: true }).sort({ createdAt: -1 }).lean(),
      WhatsAppWebhookEvent.findOne({ kind: "event" }).sort({ createdAt: -1 }).lean(),
      WhatsAppMessage.findOne({ direction: "inbound" }).sort({ timestamp: -1 }).select("timestamp").lean(),
    ]);

    const counts = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
    const sent = counts.sent ?? 0;
    const delivered = counts.delivered ?? 0;
    const read = counts.read ?? 0;
    const failed = counts.failed ?? 0;

    return apiSuccess({
      config,
      phone: unwrap(phone),
      profile: unwrap(profile),
      waba: unwrap(waba),
      phoneNumbers: unwrap(phoneNumbers),
      analytics: unwrap(analytics),
      subscribedApps: unwrap(subscribedApps),
      commerce: unwrap(commerce),
      webhook: {
        lastVerifiedAt: lastVerify?.createdAt ?? null,
        lastEventAt: lastEvent?.createdAt ?? null,
        lastInboundAt: lastInbound?.timestamp ?? null,
        recent: recentWebhookEvents.map((e) => ({
          kind: e.kind,
          ok: e.ok,
          summary: e.summary,
          createdAt: e.createdAt,
        })),
      },
      stats: {
        // every "delivered"/"read" row was also sent — report cumulative funnel numbers
        total: sent + delivered + read + failed,
        sent: sent + delivered + read,
        delivered: delivered + read,
        read,
        failed,
        inbound: inbound30d,
        unreadInbound,
      },
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
