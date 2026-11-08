import { NextResponse, type NextRequest } from "next/server";

// Without a sign-in cookie, admin pages go straight to the login page instead
// of loading first. The backend still checks the session on every request.
// While sign-in is off, the login page sends you on to the dashboard.
export function middleware(request: NextRequest) {
  const required =
    process.env.NEXT_PUBLIC_USE_BACKEND === "true" && process.env.NEXT_PUBLIC_REQUIRE_SIGN_IN === "true";
  if (request.nextUrl.pathname === "/login") {
    return required ? NextResponse.next() : NextResponse.redirect(new URL("/admin", request.url));
  }
  if (!required || request.cookies.has("session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/login"] };
