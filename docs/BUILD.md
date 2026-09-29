# Any-Buddy Pro (provider web): build rules

Read this before writing code. Decisions live in the Dev Tracker (RAID D-26 to D-43). The approved look and flows are the clickable prototype `any-buddy/design/provider-web/app2.html`; copy its behaviour, not its code.

## Stack (D-40, D-41)
- Next.js 15 App Router, React 19, TypeScript strict. Dependencies: next, react, @phosphor-icons/react. **Do not add a dependency.** Ask the lead if one seems necessary.
- The browser only calls `/api/...` through `src/lib/api.ts` (`api()` and `upload()`). The proxy (`src/app/api/[...path]/route.ts`) keeps the token in httpOnly cookies. Never read, store or log a token in page code.
- Backend reply shape: `{ status: 1|0, message, data, count }`. `api()` throws `ApiError(message, status, data)` when `status !== 1`; show `error.message` near the action that failed.
- Local: backend `http://localhost:6001/api` (set in `.env.local` as `BACKEND_URL`), app `http://localhost:3200`.

## Files you may touch
| Area | Owner | Folder |
|---|---|---|
| Foundation (tokens, proxy, api, shell, types, format) | Lead | `src/app/globals.css`, `src/app/api`, `src/lib`, `src/components/{Shell,Logo,Toast,Vendor}*`, root layouts |
| Auth | Agent 1 | `src/app/(auth)/**`, `src/app/(app)/reset/**` |
| Onboarding + setup forms | Agent 2 | `src/app/onboarding/**`, `src/components/forms/**`, `src/app/(app)/hours/**`, `src/app/(app)/account/{profile,services,documents,bank}/**` |
| Home board + job actions | Agent 3 | `src/app/(app)/page.tsx`, `src/components/board/**`, `src/components/job/**` |
| Jobs + notifications | Agent 4 | `src/app/(app)/jobs/**`, `src/app/(app)/notifications/**` |
| Earnings + account hub | Agent 5 | `src/app/(app)/earnings/**`, `src/app/(app)/account/page.tsx`, `src/app/(app)/account/{password,reviews,help,legal}/**` |

Need a shared type? Add it to `src/lib/types.ts` (append only, never change an existing field). Anything else outside your folder: tell the lead.

## Screen rules
- Every screen has a job: it shows real data from an endpoint and offers the action that data needs. No placeholders, no invented numbers, no repeated content (a number appears in one place). Empty states say what will appear and how.
- Order by importance: the job in progress or next action, then requests with timers, then the rest of today, then money (money lives on Earnings, not Home).
- Copy: statements, never questions (labels are nouns). No em or en dashes anywhere. Brand is "Any-Buddy". Plain words for money: "Ready to withdraw", "On its way to your bank", "Paid to your bank", "Taken off".
- Layout: phone < 700px, tablet 700 to 1020px, laptop > 1020px. No sideways scroll. Tap targets 44px on phones. Forms: visible label, error under the field, first wrong field gets focus, `autocomplete` set, 16px inputs.
- Style: tokens in `globals.css` only (no raw hex in components). Screen styles in a co-located `*.module.css`. Icons: `@phosphor-icons/react`, 20px. No pop-ups, drawers or overlays; actions open inline. Toasts via `useToast()` with Undo where an action can be reversed.
- Motion only when it means something (live timers, the now line, the timer ring, slide to confirm). Respect reduced motion.

## Code rules (ponytail)
- Files under 250 lines (hard stop 500). One rule in one place. No abstraction with one user, no config for a value that never changes.
- Server state: fetch in the component that needs it; refetch after a mutation. No global store.
- Money and time only through `src/lib/format.ts` (business time zone America/New_York).

## Backend endpoints (all under /api, vendor routes need the session)
- Auth `vendor/auth/`: `POST sign-up` (code step), `POST login` (403 + needsVerification when unverified), `POST verify-otp {loginOtp}`, `PUT resend-otp` (429 + codeValidFor while a code is live), `PUT forget-password {email}`, `PUT set-new-password {newPassword, confirmPassword}`, `PUT change-password {oldPassword, newPassword, confirmPassword}`, `POST logout`, `DELETE delete`, `PUT update-device-details`.
- Profile and onboarding: `GET vendor/auth/get-profile-details?type=1|2|3|4` (profile, hours, documents, bank), `POST vendor/auth/update-register-profile {step, ...}` (1 profile, 2 hours, 3 documents, 4 bank; bank changes need `password`).
- Services `vendor/services/`: `GET list-categories`, `GET list-subcategories?categoryId`, `POST add`, `GET list`, `GET detail?serviceId`, `PUT update`, `DELETE remove?serviceId`.
- Bookings `vendor/bookings/`: `GET list?status=1..4&page&limit`, `GET detail?bookingId`, `PUT update-status {bookingId, status: 2|4, message}`, `PUT on-the-way {bookingId, etaMinutes}`, `PUT send-code {bookingId}`, `PUT set-checkIn-checkOut {bookingId, verificationCode, type: 1|2, checkInImages|checkOutImages}`, `GET cancel-preview?bookingId`, `PUT cancel {bookingId, reason}`, `PUT list-day-wise?date=YYYY-MM-DD`.
- Earnings `vendor/earnings/`: `GET balance`, `POST withdraw {amount}`, `GET payouts?page&limit`, `GET overview?month`, `GET details?month|date`. Dashboard: `GET vendor/dashboard?duration`, `GET vendor/dashboard/today-bookings`.
- Notifications `vendor/notification/`: `GET list` (marks read), `PUT list-unread` (count), `PUT notify-status`.
- Shared: `GET user/booking/list-cancellation-reasons?type=2`, `GET user/services/list-rating-reviews?vendorSlug`, `GET user/cms/list?type`, `POST user/support/send-message`, `POST uploads/presign`.
- Full detail: `anybuddy-backend/docs/API.md`. Read the controller when the doc is unclear; never guess a field.

## Done means
1. `npx tsc --noEmit` and `npm run build` pass.
2. Every screen checked against the real local backend at 390, 834 and 1366 wide, light and dark: no console errors, no sideways scroll, 44px targets on phones, contrast AA.
3. Test records use emails `pw-test-<name>@anybuddy.dev` (D-42).
4. Report: files changed, endpoints used, what was checked, anything not done. **Never commit or push.**
