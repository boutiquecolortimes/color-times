import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ContactMessage } from "@/models/ContactMessage";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess } from "@/lib/api/response";

/** Customer enquiries (website contact form + "Request this dress" in the app). */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? "20")));
  const status = params.get("status") ?? "open";
  const filter: Record<string, unknown> =
    status === "all" ? {} : { isResolved: status === "resolved" };

  const [enquiries, total, openCount] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.countDocuments({ isResolved: false }),
  ]);

  return apiSuccess({
    enquiries,
    openCount,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
