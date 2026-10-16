// Money and time formatting, all in one place. Business time is New York time (America/New_York) until we support a
// time zone per address.
export const TZ = "America/New_York";
// A business day as a key, such as "2026-09-29" (New York). The backend stores a day as its midnight in New York.
export const dayKey = (d: string | Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
// "Friday, October 16" (New York).
export const longDate = (d: string | Date = new Date()) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(d));

export const money = (n: number) =>
  "$" + (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });
export const time = (d: string | Date) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d));

/** Turns minutes after midnight into US 12-hour time, so 780 becomes "1:00 PM". */
export const clockMin = (min: number) => {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
/** Turns a backend slot such as "13:00" into "1:00 PM". */
export const clock = (hhmm?: string | null) => {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) ? clockMin(h * 60 + (m || 0)) : "";
};
/** The hour mark for time grids, so 7 becomes "7 AM" and 12 becomes "12 PM". */
export const hourMark = (h: number) => `${h % 12 || 12} ${h % 24 < 12 ? "AM" : "PM"}`;
export const day = (d: string | Date) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(d));

/** Durations for Buddies and customers: hours and minutes only, never seconds. "2 hr 5 min", "45 min". */
const hrMin = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}\u00a0hr ${m}\u00a0min` : `${h}\u00a0hr`) : `${m}\u00a0min`; // a number never wraps away from its unit
};
/** Time left, rounded up so it never shows "0 min" while time remains: "1 hr 12 min", "3 min". */
export const countdown = (ms: number) => hrMin(Math.ceil(Math.max(0, ms) / 6e4));
/** Time worked so far, rounded down: "1 hr 4 min", "Just started" in the first minute. */
export const elapsed = (ms: number) => (ms < 6e4 ? "Just started" : hrMin(Math.floor(ms / 6e4)));

/** Who ended a cancelled booking, in plain words. One rule for every screen. */
export const cancelLabel = (b: { cancelledBy?: string | null; acceptedAt?: string | null }) =>
  b.cancelledBy === "customer" ? "Customer canceled"
  : b.cancelledBy === "system" ? "Expired, no answer in time"
  : b.cancelledBy === "provider" ? (b.acceptedAt ? "You canceled" : "Declined by you")
  : "Canceled";
