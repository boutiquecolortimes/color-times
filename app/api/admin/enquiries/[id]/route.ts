import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { ContactMessage } from "@/models/ContactMessage";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({ isResolved: z.boolean() });

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const input = patchSchema.parse(await request.json());
    await connectToDatabase();
    const enquiry = await ContactMessage.findByIdAndUpdate(
      id,
      { $set: { isResolved: input.isResolved } },
      { new: true }
    ).lean();
    if (!enquiry) return apiError("Enquiry not found", 404);
    return apiSuccess({ enquiry });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
