// Backend-for-frontend (D-41). The browser only ever calls /api/*; this handler forwards to BACKEND_URL
// and keeps the backend token in httpOnly cookies, so page scripts can never read it.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL;
const SESSION = "ab_pro"; // full 30-day token
const CODE = "ab_pro_code"; // 15-minute code-step token (sign-up, forgot password, unverified login)
// Only what a Buddy may call. Admin routes are never reachable through this app.
const ALLOWED = /^(vendor\/|uploads\/presign$|list-location$|user\/(cms|support|conversation|booking\/list-cancellation-reasons|services\/list-rating-reviews))/;
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
  const path = (await ctx.params).path.join("/");
  if (!BACKEND) return NextResponse.json({ status: 0, message: "BACKEND_URL is not set." }, { status: 500 });
  if (!ALLOWED.test(path)) return NextResponse.json({ status: 0, message: "Not found." }, { status: 404 });

  const jar = await cookies();
  const code = jar.get(CODE)?.value;
  const token = code && CODE_ROUTES.test(path) ? code : jar.get(SESSION)?.value;
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authtoken", token);
  // The browser's address, for per-person rate limits and Stripe's terms acceptance. The backend trusts it only with
  // the shared key; unset, nothing extra is sent and the backend sees this server's address.
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
  // The bank reply carries the decrypted account number; the browser only ever gets the last 4 (backend fix: BUG-77).
  if (path === "vendor/auth/get-profile-details" && req.nextUrl.searchParams.get("type") === "4") {
    for (const k of ["account_number", "accountNumber"]) {
      const v = json.data?.[k];
      if (typeof v === "string" && v.length > 4) json.data[k] = "•".repeat(v.length - 4) + v.slice(-4);
    }
  }

  // Take any token out of the reply and store it as a cookie instead.
  const fresh: unknown = path === "vendor/auth/change-password" ? json.data : json.data?.token;
  if (typeof fresh === "string") {
    if (typeof json.data === "object") delete json.data.token;
    else json.data = null;
  }
  const res = NextResponse.json(json, { status: upstream.status });
  if (typeof fresh === "string") {
    if (stageOf(fresh) === "otp") res.cookies.set(CODE, fresh, { ...cookieBase, maxAge: 15 * 60 });
    else {
      res.cookies.set(SESSION, fresh, { ...cookieBase, maxAge: 30 * 24 * 3600 });
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
