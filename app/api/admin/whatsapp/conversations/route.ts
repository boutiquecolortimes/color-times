import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { WhatsAppMessage } from "@/models/WhatsAppMessage";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";
import { escapeRegex } from "@/lib/utils";

export interface ConversationSummary {
  waId: string;
  contactName?: string;
  lastText?: string;
  lastDirection: "inbound" | "outbound";
  lastStatus: string;
  lastAt: string;
  lastInboundAt?: string;
  unread: number;
}

/** Inbox list — one row per customer number, newest activity first. */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const match = search
      ? {
          $or: [
            { waId: { $regex: escapeRegex(search.replace(/\D/g, "") || search), $options: "i" } },
            { contactName: { $regex: escapeRegex(search), $options: "i" } },
          ],
        }
      : {};

    const conversations = await WhatsAppMessage.aggregate<ConversationSummary>([
      { $match: match },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$waId",
          lastText: { $first: "$text" },
          lastDirection: { $first: "$direction" },
          lastStatus: { $first: "$status" },
          lastAt: { $first: "$timestamp" },
          // prefer the name the customer's own WhatsApp profile reports
          inboundName: {
            $first: { $cond: [{ $eq: ["$direction", "inbound"] }, "$contactName", null] },
          },
          anyName: { $max: "$contactName" },
          lastInboundAt: { $max: { $cond: [{ $eq: ["$direction", "inbound"] }, "$timestamp", null] } },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "inbound"] }, { $eq: ["$readByStaff", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastAt: -1 } },
      { $limit: 200 },
      {
        $project: {
          _id: 0,
          waId: "$_id",
          contactName: { $ifNull: ["$inboundName", "$anyName"] },
          lastText: 1,
          lastDirection: 1,
          lastStatus: 1,
          lastAt: 1,
          lastInboundAt: 1,
          unread: 1,
        },
      },
    ]);

    return apiSuccess({ conversations });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
