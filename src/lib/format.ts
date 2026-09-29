// Money and time, one place. Business time zone is America/New_York until per-address zones (D-32).
export const TZ = "America/New_York";

export const money = (n: number) =>
  "$" + (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });
export const time = (d: string | Date) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d));

/** US 12-hour clock from minutes after midnight: 780 → "1:00 PM". */
export const clockMin = (min: number) => {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
/** "13:00" (backend slot) → "1:00 PM". */
export const clock = (hhmm?: string | null) => {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) ? clockMin(h * 60 + (m || 0)) : "";
};
/** Hour mark for time grids: 7 → "7 AM", 12 → "12 PM". */
export const hourMark = (h: number) => `${h % 12 || 12} ${h % 24 < 12 ? "AM" : "PM"}`;
export const day = (d: string | Date) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(d));

/** Durations for Buddies and customers: hours and minutes only, never seconds (owner, 29 Sep). "2 hr 5 min", "45 min". */
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
