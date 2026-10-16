// A backend-for-frontend proxy. The browser only ever calls /api/*. This handler forwards each call to BACKEND_URL
// and keeps the backend token in httpOnly cookies, so page scripts can never read it.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL;
const SESSION = "ab_pro"; // the full Buddy token, for a 90-day session that renews with use
const SESSION_AGE = 90 * 24 * 3600;
const CODE = "ab_pro_code"; // a 15-minute token for the email code step ("Can't use this number?")
// Only what a Buddy may call. Admin routes are never reachable through this app.
const ALLOWED = /^(vendor\/|uploads\/presign$|list-location$|config$|user\/(cms|support|conversation|booking\/list-cancellation-reasons|services\/list-rating-reviews))/;
const CODE_ROUTES = /^vendor\/auth\/(verify-otp|resend-otp)$/;
const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

const stageOf = (token: string): string | undefined => {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).stage;
  } catch {
    return undefined;
  }
};

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  // "vendor/../admin/x" would pass the check below and then resolve upstream to /admin/x, so dot segments are refused.
  if (parts.some((p) => p === "." || p === ".." || /[\\/%]/.test(p))) return NextResponse.json({ status: 0, message: "Not found." }, { status: 404 });
  const path = parts.join("/");
  if (!BACKEND) return NextResponse.json({ status: 0, message: "BACKEND_URL is not set." }, { status: 500 });
  if (!ALLOWED.test(path)) return NextResponse.json({ status: 0, message: "Not found." }, { status: 404 });

  const jar = await cookies();
  const code = jar.get(CODE)?.value;
  const token = code && CODE_ROUTES.test(path) ? code : jar.get(SESSION)?.value;
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authtoken", token);
  // Passes on the browser's IP address, for per-person rate limits and for recording Stripe's terms acceptance. The
  // backend trusts it only when the shared key comes with it. When the key isn't set, nothing extra is sent and the
  // backend sees this server's address.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip");
  if (process.env.PROXY_SHARED_SECRET && ip) {
    headers.set("x-ab-proxy-key", process.env.PROXY_SHARED_SECRET);
    headers.set("x-ab-client-ip", ip);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/${path}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : await req.text(),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ status: 0, message: "We can't reach Any-Buddy right now. Try again in a moment." }, { status: 502 });
  }
  const json = await upstream.json().catch(() => null);
  if (!json) {
    const busy = upstream.status === 429;
    const message = busy ? "Too many tries. Wait a few minutes and try again." : "Something went wrong. Try again.";
    return NextResponse.json({ status: 0, message }, { status: busy ? 429 : 502 });
  }
  // The bank reply carries the decrypted account number; the browser only ever gets the last 4.
  if (path === "vendor/auth/get-profile-details" && req.nextUrl.searchParams.get("type") === "4") {
    for (const k of ["account_number", "accountNumber"]) {
      const v = json.data?.[k];
      if (typeof v === "string" && v.length > 4) json.data[k] = "•".repeat(v.length - 4) + v.slice(-4);
    }
  }

  // Take any token out of the reply and store it as a cookie instead. The session renews with use, so a renewed token
  // can arrive in the X-Auth-Token header of an ordinary reply.
  const inBody: unknown = path === "vendor/auth/change-password" ? json.data : json.data?.token;
  if (typeof inBody === "string") {
    if (typeof json.data === "object") delete json.data.token;
    else json.data = null;
  }
  const fresh = typeof inBody === "string" ? inBody : upstream.headers.get("x-auth-token");
  const res = NextResponse.json(json, { status: upstream.status });
  if (fresh) {
    if (stageOf(fresh) === "otp") res.cookies.set(CODE, fresh, { ...cookieBase, maxAge: 15 * 60 });
    else {
      res.cookies.set(SESSION, fresh, { ...cookieBase, maxAge: SESSION_AGE });
      res.cookies.delete(CODE);
    }
  }
  const expired = upstream.status === 401 || (upstream.status === 403 && /expired token/i.test(json.message ?? ""));
  if ((expired && !path.startsWith("vendor/auth/login")) || (/^vendor\/auth\/(logout|delete)$/.test(path) && upstream.ok)) {
    res.cookies.delete(SESSION);
    res.cookies.delete(CODE);
  }
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
