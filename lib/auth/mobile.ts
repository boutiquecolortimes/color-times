import type { NextRequest } from "next/server";

/**
 * The mobile app identifies itself with this header. Only then do auth
 * routes hand the raw JWTs back in the response body (the app keeps them in
 * the device keychain / keystore via expo-secure-store). Web clients never
 * get tokens in the body — they stay in httpOnly cookies.
 */
export const MOBILE_CLIENT_HEADER = "x-client";
export const MOBILE_CLIENT_VALUE = "color-times-mobile";

export function isMobileClient(request: NextRequest | Request): boolean {
  return request.headers.get(MOBILE_CLIENT_HEADER) === MOBILE_CLIENT_VALUE;
}
