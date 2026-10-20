import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

const tokenSchema = z.object({
  // Firebase Cloud Messaging registration token (Android + iOS).
  token: z.string().trim().min(20, "Invalid push token").max(4096),
});

/** Registers this device for push notifications. */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { token } = tokenSchema.parse(await request.json());
    await connectToDatabase();
    // A device belongs to one account at a time.
    await User.updateMany({ pushTokens: token }, { $pull: { pushTokens: token } });
    await User.updateOne({ _id: auth.user.sub }, { $addToSet: { pushTokens: token } });
    return apiSuccess({ registered: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

/** Called on sign-out so the device stops receiving this account's pushes. */
export async function DELETE(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { token } = tokenSchema.parse(await request.json());
    await connectToDatabase();
    await User.updateOne({ _id: auth.user.sub }, { $pull: { pushTokens: token } });
    return apiSuccess({ registered: false });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
