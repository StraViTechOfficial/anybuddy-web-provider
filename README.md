# Any-Buddy Pro (website for Buddies)

The website Buddies (AnyBuddy's service providers) use to run their work: sign in with their mobile number, get
verified, manage their profile, services and rates, working hours and time off, take and complete jobs, and follow
their earnings and payouts. One responsive layout covers phone, tablet and laptop.

## Stack

- Next.js 15 (App Router), React 19, TypeScript.
- Icons: `@phosphor-icons/react`. No UI kit; styles are plain CSS (`globals.css` plus CSS modules).

## How it talks to the API

- The browser only calls `/api/*` on this site. `src/app/api/[...path]/route.ts` forwards each call to
  `BACKEND_URL` (the AnyBuddy API; production is `https://api-prod.any-buddy.com/api`).
- The login token never reaches page scripts: the proxy takes it out of the API reply and keeps it in httpOnly
  cookies (`ab_pro`, a 90-day sliding session; `ab_pro_code`, a 15-minute token for the code step).
- Only an allow-list of paths is forwarded (Buddy `vendor/*` routes plus a few shared ones such as `config` and
  `uploads/presign`); admin routes are never reachable. Path segments `.` and `..` are refused.
- The bank details reply is masked so the browser only ever sees the last 4 digits of the account number.
- With `PROXY_SHARED_SECRET` set, the proxy passes the visitor's address to the API so rate limits apply per visitor.
- `src/middleware.ts` sends signed-out visitors to `/login` (only `/login`, `/recover` and `/verify-email` are public).
- `/onboarding/geocode` is a small server route that turns a typed US address into a map point (US Census geocoder).
- Bank and card numbers for Stripe payouts go from the browser straight to Stripe (Stripe.js) as tokens.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3200
npm run typecheck    # optional: TypeScript check
```

Environment variables (put them in `.env.local`; names only, never commit values):

| Name | Purpose |
|---|---|
| `BACKEND_URL` | Base URL of the AnyBuddy API, ending in `/api`. Required. |
| `PROXY_SHARED_SECRET` | Same value as the API's; lets rate limits see the visitor's address. Optional. |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Maps browser key (Maps JavaScript, Places, Geocoding). Optional: without it, plain address fields and a drawn service-area circle are shown. |
| `NEXT_DIST_DIR` | Optional build output folder (default `.next`). |

## Build and deploy

- `npm run build`, then `npm run start` (port 3200) to run the build locally.
- Deployed on Vercel from the `staging` branch. Set the environment variables above in the Vercel project.

## Security notes

- `next.config.ts` sends security headers on every page: `Content-Security-Policy: frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`;
  the `X-Powered-By` header is off.
- Session cookies are httpOnly, `SameSite=Lax`, and `Secure` in production.
- After login the `next` redirect only accepts same-site paths.
