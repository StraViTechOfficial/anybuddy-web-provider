import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
