import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset, RESET_RESEND_COOLDOWN_MS } from "@/lib/auth/password-reset";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

/**
 * Step 1 of "Forgot password": email a 6-digit code. Always answers the same
 * way whether or not the email has an account, so it can't be used to find
 * out who is registered.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { email } = forgotPasswordSchema.parse(await request.json());
    await connectToDatabase();
    await requestPasswordReset(email);
    return apiSuccess({
      sent: true,
      message: "If an account exists for this email, a reset code is on its way.",
      resendAfterSeconds: Math.round(RESET_RESEND_COOLDOWN_MS / 1000),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
