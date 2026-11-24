import {
  AUTH_COOKIE_NAME,
  getSafeRedirectPath,
  isAuthConfigured,
  verifyAuthToken,
} from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow MCP API endpoints to pass through for Bearer token authentication
  if (pathname.startsWith("/api/mcp")) {
    return NextResponse.next();
  }

  // If AUTH_PASSWORD or AUTH_SECRET is missing or empty on the env
  if (!isAuthConfigured()) {
    // Only the homepage is allowed to display the configuration error notice
    if (pathname === "/") {
      return NextResponse.next();
    }
    // All other routes redirect to homepage
    return NextResponse.redirect(new URL("/", request.url));
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = await verifyAuthToken(token);

  const isLoginPage = pathname === "/login";

  // If already authenticated and visiting /login, redirect to target or home
  if (isLoginPage) {
    if (isAuthenticated) {
      const redirectParam = request.nextUrl.searchParams.get("redirect");
      const target = getSafeRedirectPath(redirectParam);
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // If not authenticated and visiting any protected route, redirect to /login
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - Favicon, svg, png, and common static assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js)$).*)",
  ],
};
