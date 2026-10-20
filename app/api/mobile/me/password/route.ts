import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ALL_ROLES } from "@/lib/auth/roles";
import { changePasswordSchema } from "@/lib/validations/account";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/tokens";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

/** Password change for any role from the mobile app; returns the fresh token pair. */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ALL_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const input = changePasswordSchema.parse(await request.json());
    await connectToDatabase();

    const user = await User.findById(auth.user.sub).select("+passwordHash +tokenVersion");
    if (!user) return apiError("Account not found", 404);

    const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isValid) return apiError("Current password is incorrect", 401);

    user.passwordHash = await hashPassword(input.newPassword);
    // Signs every other device out.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    const accessToken = await signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });
    const refreshToken = await signRefreshToken({
      sub: user._id.toString(),
      tokenVersion: user.tokenVersion,
    });

    return apiSuccess({ changed: true, accessToken, refreshToken });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
