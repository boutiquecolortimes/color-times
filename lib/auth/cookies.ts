export const ACCESS_TOKEN_COOKIE = "ct_access_token";
export const REFRESH_TOKEN_COOKIE = "ct_refresh_token";

export const accessTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // The JWT inside still expires after 15 minutes; the cookie is kept for
  // 8 hours (the admin idle timeout in session-refresher.tsx). If a page is
  // opened with an expired token still in the cookie, the user was active
  // within that window, so proxy.ts silently renews the session instead of
  // bouncing to /login. Cookie gone = idle for 8+ hours → login.
  maxAge: 60 * 60 * 8, // 8 hours
};

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};
