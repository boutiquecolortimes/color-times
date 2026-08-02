import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { NotificationLog } from "@/models/NotificationLog";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    const filter: Record<string, unknown> = { channel: "whatsapp" };
    if (status && status !== "all") {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { recipientName: { $regex: search, $options: "i" } },
        { recipientPhone: { $regex: search, $options: "i" } },
        { templateName: { $regex: search, $options: "i" } },
      ];
    }

    const [logs, total] = await Promise.all([
      NotificationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      NotificationLog.countDocuments(filter),
    ]);

    return apiSuccess({
      logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
