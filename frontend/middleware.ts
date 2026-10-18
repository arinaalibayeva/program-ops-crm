import { NextResponse, type NextRequest } from "next/server";

// Without a sign-in cookie, admin pages go straight to the login page instead
// of loading first. The backend still checks the session on every request.
export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_USE_BACKEND !== "true") return NextResponse.next();
  if (request.cookies.has("session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*"] };
