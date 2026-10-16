import { NextResponse, type NextRequest } from "next/server";

// Pages a signed-out Buddy may open. Everything else needs the session cookie. /verify-email stays, because sign-up
// emails from the older Pro app (version 1.2) still link to it.
const PUBLIC = ["/login", "/recover", "/verify-email"];

// The files bucket. Photos and documents are shown from it, and uploads go straight to it with a presigned link. The
// backend builds links in the regional form, and older records may use the global form.
const S3 = "https://anybuddy-files-2026.s3.us-east-1.amazonaws.com https://anybuddy-files-2026.s3.amazonaws.com";

/** The Content Security Policy for one page view. Scripts run only from this site, from Stripe and Google Maps, or
 *  inline with this request's nonce, so an injected script tag can't run. Every other host below is listed with the
 *  reason it is needed. Next.js sets inline style attributes, so styles keep 'unsafe-inline'. */
function policy(nonce: string, local: boolean) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // Stripe.js (js.stripe.com) turns bank and card numbers into tokens in the browser. Google Maps
    // (maps.googleapis.com) powers address suggestions and the travel circle. The dev server also needs eval for
    // hot reload.
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://maps.googleapis.com${dev ? " 'unsafe-eval'" : ""}`,
    // Google Maps adds its own styles and loads its Roboto font stylesheet.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Photos come from the files bucket. blob: is the preview of a file just picked or a selfie just taken, and data:
    // covers small inline icons. Category and service photos are Unsplash links, and customers who signed in with Google
    // have their Google profile photo. The other Google hosts serve map tiles and markers.
    `img-src 'self' data: blob: ${S3} https://images.unsplash.com https://lh3.googleusercontent.com https://maps.googleapis.com https://maps.gstatic.com`,
    // The proxy at /api is on this site. Uploads go to the files bucket, Stripe.js creates tokens at api.stripe.com,
    // and Google Maps fetches suggestions and tiles from its APIs.
    `connect-src 'self' ${S3} https://api.stripe.com https://maps.googleapis.com https://places.googleapis.com`,
    // Stripe shows the card field and its security checks in its own frames. A PDF preview shows the picked file
    // (blob:) or the signed link to the bucket.
    `frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network blob: ${S3}`,
    // Google Maps draws in a worker it creates from a blob.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // On the live https site, any stray http:// link is fetched over https instead. A local run is plain http, where
    // this would break the page's own requests.
    ...(local ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

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
  // Next.js reads the nonce from this request header and adds it to its own inline scripts. That only works when the
  // page is rendered per request, which the root layout makes sure of.
  const csp = policy(btoa(crypto.randomUUID()), req.nextUrl.hostname === "localhost");
  const headers = new Headers(req.headers);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = { matcher: ["/((?!api|_next|favicon|mark.png|wordmark.png).*)"] };
