import { NextResponse, type NextRequest } from "next/server";
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

type RefreshResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; message: string; status: number };

async function renewSession(request: NextRequest): Promise<RefreshResult> {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return { ok: false, message: "No refresh token provided", status: 401 };
  }

  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return { ok: false, message: "Session expired, please log in again", status: 401 };
  }

  await connectToDatabase();
  const user = await User.findById(payload.sub).select("+tokenVersion");
  if (!user) {
    return { ok: false, message: "Session expired, please log in again", status: 401 };
  }

  if (!user.isActive) {
    return {
      ok: false,
      message: "This account has been deactivated. Contact an administrator.",
      status: 403,
    };
  }

  // A password change (self-service or admin reset) bumps tokenVersion,
  // which immediately invalidates every refresh token issued before that
  // change — even ones that haven't hit their 30-day expiry yet.
  if (payload.tokenVersion !== (user.tokenVersion ?? 0)) {
    return { ok: false, message: "Session expired, please log in again", status: 401 };
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
  return { ok: true, accessToken, refreshToken: newRefreshToken };
}

// Used by the admin panel's background keepalive and its fetch retry.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const result = await renewSession(request);
    if (!result.ok) return apiError(result.message, result.status);

    const response = apiSuccess({ refreshed: true });
    response.cookies.set(ACCESS_TOKEN_COOKIE, result.accessToken, accessTokenCookieOptions);
    response.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken, refreshTokenCookieOptions);
    return response;
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

// Page navigations land here (via proxy.ts) when the access token has just
// expired — e.g. the laptop slept or the tab was in the background, so the
// keepalive timer missed a beat. Renew and send the user straight back to
// the page they asked for, instead of logging them out mid-work.
export async function GET(request: NextRequest): Promise<Response> {
  const requested = request.nextUrl.searchParams.get("next") ?? "/admin";
  // Only same-site paths — never an open redirect to another domain.
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/admin";

  try {
    const result = await renewSession(request);
    if (result.ok) {
      const response = NextResponse.redirect(new URL(next, request.url));
      response.cookies.set(ACCESS_TOKEN_COOKIE, result.accessToken, accessTokenCookieOptions);
      response.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken, refreshTokenCookieOptions);
      return response;
    }
  } catch {
    // fall through to login
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);
  loginUrl.searchParams.set("reason", "session-ended");
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
