import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { ADMIN_ROLES } from "@/lib/auth/roles";

const GATED_MARKETING_PREFIXES = [
  "/home",
  "/collections",
  "/about",
  "/contact",
  "/faq",
  "/gallery",
  "/offers",
  "/testimonials",
  "/blog",
  "/terms",
  "/order-tracking",
  "/account",
  "/wishlist",
];

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

// The access cookie outlives its 15-minute token for the 30-minute idle
// window (see lib/auth/cookies.ts), so an expired token that's still in the
// cookie means the user was active recently — renew silently and come
// straight back, rather than logging them out mid-task.
function redirectToRenew(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const renewUrl = new URL("/api/auth/refresh", request.url);
  renewUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(renewUrl);
}

function canRenew(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value && request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  );
}

function redirectToSiteLock(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/site-locked", request.url));
}

/**
 * Optimistic route guard only — redirects when there is no valid access token,
 * or (for /admin) when the token's role isn't privileged enough. Actual token
 * refresh happens client-side against /api/auth/refresh (Node runtime,
 * DB-backed), since minting a real access token here would require a
 * database lookup Proxy's edge runtime isn't meant to perform.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isGatedMarketingRoute = GATED_MARKETING_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  // The public marketing site is currently restricted to the developer
  // account only, while the ERP work is in progress. Everyone else —
  // logged out, or logged in as staff/admin/super_admin/customer — is
  // redirected to a locked notice.
  if (isGatedMarketingRoute) {
    if (!accessToken) {
      return redirectToLogin(request, pathname);
    }
    try {
      const payload = await verifyAccessToken(accessToken);
      if (payload.role !== "developer") {
        return redirectToSiteLock(request);
      }
    } catch {
      return redirectToLogin(request, pathname);
    }
    return NextResponse.next();
  }

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  if (!accessToken) {
    return redirectToLogin(request, pathname);
  }

  try {
    const payload = await verifyAccessToken(accessToken);

    if (isAdminRoute && !ADMIN_ROLES.includes(payload.role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch {
    if (canRenew(request)) return redirectToRenew(request);
    return redirectToLogin(request, pathname);
  }
}

export const config = {
  matcher: [
    "/account/:path*",
    "/wishlist/:path*",
    "/admin/:path*",
    "/home/:path*",
    "/collections/:path*",
    "/about/:path*",
    "/contact/:path*",
    "/faq/:path*",
    "/gallery/:path*",
    "/offers/:path*",
    "/testimonials/:path*",
    "/blog/:path*",
    "/terms/:path*",
    "/order-tracking/:path*",
  ],
};
