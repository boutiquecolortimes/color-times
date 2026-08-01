import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/tokens";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "@/lib/auth/cookies";
import { registerSchema } from "@/lib/validations/auth";
import { sendVerificationEmail } from "@/lib/notifications/verification-email";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);

    await connectToDatabase();

    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      return apiError("An account with this email already exists", 409);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await User.create({
      name: input.name,
      email: input.email,
      phone: input.phone || undefined,
      passwordHash,
      role: "customer",
    });

    void sendVerificationEmail(user._id.toString(), user.email, user.name);

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

    const response = apiSuccess(
      { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
      201
    );
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions);
    return response;
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
