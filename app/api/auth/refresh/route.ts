import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/tokens";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "@/lib/auth/cookies";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) {
      return apiError("No refresh token provided", 401);
    }

    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      return apiError("Session expired, please log in again", 401);
    }

    await connectToDatabase();
    const user = await User.findById(payload.sub).select("+tokenVersion");
    if (!user) {
      return apiError("Session expired, please log in again", 401);
    }

    if (!user.isActive) {
      return apiError("This account has been deactivated. Contact an administrator.", 403);
    }

    // A password change (self-service or admin reset) bumps tokenVersion,
    // which immediately invalidates every refresh token issued before that
    // change — even ones that haven't hit their 30-day expiry yet.
    if (payload.tokenVersion !== (user.tokenVersion ?? 0)) {
      return apiError("Session expired, please log in again", 401);
    }

    const accessToken = await signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });
    const newRefreshToken = await signRefreshToken({
      sub: user._id.toString(),
      tokenVersion: user.tokenVersion ?? 0,
    });

    const response = apiSuccess({ refreshed: true });
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
    response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, refreshTokenCookieOptions);
    return response;
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
