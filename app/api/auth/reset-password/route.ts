import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPasswordWithCode } from "@/lib/auth/password-reset";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

/** Step 2 of "Forgot password": check the emailed code and set the new password. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const input = resetPasswordSchema.parse(await request.json());
    await connectToDatabase();
    const result = await resetPasswordWithCode(input.email, input.code, input.password);
    if (result.ok) return apiSuccess({ reset: true });

    if (result.reason === "expired") {
      return apiError("This code has expired. Request a new one.", 400);
    }
    if (result.reason === "too_many") {
      return apiError("Too many wrong codes. Request a new one.", 429);
    }
    return apiError(
      result.attemptsLeft
        ? `That code isn't right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`
        : "That code isn't right, or it was already used. Request a new one.",
      400
    );
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
