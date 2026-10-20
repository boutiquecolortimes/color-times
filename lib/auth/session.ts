import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { verifyAccessToken, type AccessTokenPayload } from "./tokens";

/**
 * The web app authenticates with an httpOnly cookie; the React Native app
 * (mobile/) can't use cookies reliably, so it sends the same access JWT as
 * `Authorization: Bearer <token>`. Both resolve to the same payload, so every
 * existing API route and role check works unchanged for mobile clients.
 */
async function readAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (fromCookie) return fromCookie;

  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || undefined;
  }
  return undefined;
}

export const getCurrentUser = cache(async (): Promise<AccessTokenPayload | null> => {
  const token = await readAccessToken();

  if (!token) {
    return null;
  }

  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
});

export async function requireRole(
  allowedRoles: AccessTokenPayload["role"][]
): Promise<AccessTokenPayload | null> {
  const user = await getCurrentUser();
  if (!user || !allowedRoles.includes(user.role)) {
    return null;
  }
  return user;
}
