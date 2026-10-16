import type { NextConfig } from "next";

// Security headers on every page: no framing by other sites (clickjacking), no MIME guessing, no full URLs leaked
// to other sites in the Referer header.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
  // NEXT_DIST_DIR lets a production build run beside the dev server without touching its .next folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // v2 (R1.2): phone login only. Old email + password screens send bookmarks and links to the phone login.
  redirects: async () => [
    ...["/signup", "/forgot", "/code", "/reset"].map((source) => ({ source, destination: "/login", permanent: false })),
    { source: "/account/password", destination: "/account", permanent: false },
    // v3: no onboarding steps before Home; Home's "Get verified" shows what is next. (/onboarding/geocode stays.)
    { source: "/onboarding", destination: "/", permanent: false },
  ],
};

export default nextConfig;
