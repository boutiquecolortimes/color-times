import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { Notification, type NotificationType } from "@/models/Notification";
import { User, type UserRole } from "@/models/User";
import { sendPush } from "@/lib/notifications/fcm-push";

interface NotifyAccountsPayload {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/** Fire-and-forget in-app notification fan-out; must never break the calling request. */
export async function notifyAccounts(roles: UserRole[], payload: NotifyAccountsPayload): Promise<void> {
  try {
    await connectToDatabase();

    const recipients = await User.find({ role: { $in: roles }, isActive: true })
      .select("_id +pushTokens")
      .lean();
    if (recipients.length === 0) return;

    await Notification.insertMany(
      recipients.map((recipient) => ({
        recipient: recipient._id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        relatedEntityType: payload.relatedEntityType,
        relatedEntityId: payload.relatedEntityId,
      }))
    );

    // Mirror to the mobile app as a push notification (no-op when nobody
    // has the app installed / signed in).
    const stale = await sendPush(
      recipients.flatMap((recipient) => recipient.pushTokens ?? []),
      { title: payload.title, body: payload.message, data: { link: payload.link, type: payload.type } }
    );
    if (stale.length > 0) {
      await User.updateMany({ pushTokens: { $in: stale } }, { $pull: { pushTokens: { $in: stale } } });
    }
  } catch {
    // Notifications must never break the calling request/route.
  }
}
