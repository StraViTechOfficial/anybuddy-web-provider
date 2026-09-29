import { NextResponse, type NextRequest } from "next/server";

// Pages a signed-out Buddy may open. Everything else needs the session cookie.
const PUBLIC = ["/login", "/signup", "/code", "/forgot", "/verify-email"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = req.cookies.has("ab_pro");
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!signedIn && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (signedIn && isPublic) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon|mark.png|wordmark.png).*)"] };
