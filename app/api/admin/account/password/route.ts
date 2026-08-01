import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { changePasswordSchema } from "@/lib/validations/account";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/tokens";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "@/lib/auth/cookies";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = changePasswordSchema.parse(body);

    await connectToDatabase();

    const user = await User.findById(auth.user.sub).select("+passwordHash +tokenVersion");
    if (!user) {
      return apiError("Account not found", 404);
    }

    const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isValid) {
      return apiError("Current password is incorrect", 401);
    }

    user.passwordHash = await hashPassword(input.newPassword);
    // Bumping this invalidates every other refresh token issued for this
    // account (other devices/browsers get logged out on their next silent
    // refresh). We reissue fresh cookies below so this session — the one
    // that just changed the password — stays logged in seamlessly.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await recordAuditLog({
      entityType: "User",
      entityId: auth.user.sub,
      action: "update",
      actor: auth.user,
      changes: [{ field: "passwordHash", from: "(previous)", to: "(changed by self)" }],
    });

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

    const response = apiSuccess({ changed: true });
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions);
    return response;
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
