import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/tokens";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "@/lib/auth/cookies";
import { loginSchema } from "@/lib/validations/auth";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    await connectToDatabase();

    const user = await User.findOne({ email: input.email }).select(
      "+passwordHash +tokenVersion +failedLoginAttempts +lockedUntil"
    );
    if (!user) {
      return apiError("Invalid email or password", 401);
    }

    // DB-backed lockout (not in-memory) so it holds up across serverless
    // instances, which don't share memory with each other.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return apiError(
        `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        429
      );
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        user.failedLoginAttempts = 0;
        await user.save();
        return apiError(
          `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
          429
        );
      }
      await user.save();
      return apiError("Invalid email or password", 401);
    }

    if (!user.isActive) {
      return apiError("This account has been deactivated. Contact an administrator.", 403);
    }

    // One active session per account: bumping tokenVersion on every login
    // invalidates whatever refresh token an earlier session on another
    // device/browser was holding, so it gets signed out on its next silent
    // refresh (at most ~15 min later, when its access token runs out).
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
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

    const response = apiSuccess({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions);
    return response;
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
