import "server-only";
import crypto from "crypto";
import { User } from "@/models/User";
import { siteConfig } from "@/lib/config/site";
import { sendTransactionalEmail } from "@/lib/notifications/brevo-email";
import { hashPassword } from "@/lib/auth/password";

/** How long an emailed code stays valid. */
export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
/** Wrong guesses allowed before the code is thrown away. */
export const RESET_MAX_ATTEMPTS = 5;
/** Minimum gap between two codes for the same account. */
export const RESET_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Codes are stored as an HMAC keyed with a server secret, never in plain
 * text, so a copy of the database alone can't be used to recover them.
 */
export function hashResetCode(userId: string, code: string): string {
  const key = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_ACCESS_SECRET ?? "";
  return crypto.createHmac("sha256", key).update(`${userId}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function buildResetEmailHtml(name: string, code: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #1f2937;">
      <h1 style="font-size: 22px; margin-bottom: 8px;">Reset your password</h1>
      <p>Hi ${name},</p>
      <p>Use this code to set a new password for your ${siteConfig.name} account:</p>
      <p style="margin: 28px 0; font-size: 32px; letter-spacing: 10px; font-weight: bold; color: #3d1229;">${code}</p>
      <p style="font-size: 13px; color: #6b7280;">The code expires in 15 minutes. If you didn't ask to reset your password, you can ignore this email — your password stays the same.</p>
    </div>
  `;
}

export type RequestResetResult = "sent" | "cooldown" | "ignored";

/**
 * Emails a fresh 6-digit code to an active account. Unknown or deactivated
 * emails are "ignored" — the route answers the same either way, so the
 * endpoint can't be used to discover who has an account.
 */
export async function requestPasswordReset(email: string): Promise<RequestResetResult> {
  const user = await User.findOne({ email, deletedAt: null }).select(
    "+passwordResetRequestedAt name email isActive"
  );
  if (!user || !user.isActive) return "ignored";

  const last = user.passwordResetRequestedAt?.getTime() ?? 0;
  if (Date.now() - last < RESET_RESEND_COOLDOWN_MS) return "cooldown";

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  user.passwordResetCodeHash = hashResetCode(user._id.toString(), code);
  user.passwordResetExpires = new Date(Date.now() + RESET_CODE_TTL_MS);
  user.passwordResetAttempts = 0;
  user.passwordResetRequestedAt = new Date();
  await user.save();

  const sent = await sendTransactionalEmail({
    to: user.email,
    toName: user.name,
    subject: `Your ${siteConfig.name} password reset code`,
    htmlContent: buildResetEmailHtml(user.name, code),
  });
  if (!sent.success) console.error("Password reset email failed:", sent.error);
  return "sent";
}

export type ResetResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "too_many"; attemptsLeft?: number };

/**
 * Checks the code and sets the new password. Success also clears any login
 * lockout and bumps tokenVersion, which signs the account out everywhere else.
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string
): Promise<ResetResult> {
  const user = await User.findOne({ email, deletedAt: null }).select(
    "+passwordResetCodeHash +passwordResetExpires +passwordResetAttempts +tokenVersion +failedLoginAttempts +lockedUntil isActive"
  );
  if (!user || !user.isActive || !user.passwordResetCodeHash || !user.passwordResetExpires) {
    return { ok: false, reason: "invalid" };
  }
  if (user.passwordResetExpires.getTime() < Date.now()) {
    clearReset(user);
    await user.save();
    return { ok: false, reason: "expired" };
  }

  if (!sameHash(user.passwordResetCodeHash, hashResetCode(user._id.toString(), code))) {
    const attempts = (user.passwordResetAttempts ?? 0) + 1;
    if (attempts >= RESET_MAX_ATTEMPTS) {
      clearReset(user);
      await user.save();
      return { ok: false, reason: "too_many" };
    }
    user.passwordResetAttempts = attempts;
    await user.save();
    return { ok: false, reason: "invalid", attemptsLeft: RESET_MAX_ATTEMPTS - attempts };
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  // Getting the code proves the user owns the inbox.
  user.isEmailVerified = true;
  clearReset(user);
  await user.save();
  return { ok: true };
}

function clearReset(user: {
  passwordResetCodeHash?: string;
  passwordResetExpires?: Date;
  passwordResetAttempts?: number;
}) {
  user.passwordResetCodeHash = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetAttempts = 0;
}
