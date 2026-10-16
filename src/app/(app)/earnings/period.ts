// Works out periods and chart bars from business-day keys ("YYYY-MM-DD" in the business time zone). These functions
// are pure: they read no clock and no time zone. period.check.mjs tests them (node --experimental-strip-types).
export const PERIODS = { week: "This week", month: "This month", last: "Last month", all: "All time" } as const;
export type Period = keyof typeof PERIODS;
export const isPeriod = (v: unknown): v is Period => typeof v === "string" && v in PERIODS;

export type Bar = { label: string; name: string; from: string; to: string; total: number; now: boolean; later: boolean };

const toDate = (k: string) => new Date(k + "T00:00:00Z");
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (k: string, n: number) => { const d = toDate(k); d.setUTCDate(d.getUTCDate() + n); return toKey(d); };
const lastOfMonth = (k: string) => { const d = toDate(k.slice(0, 8) + "01"); d.setUTCMonth(d.getUTCMonth() + 1, 0); return toKey(d); };
const label = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(toDate(k));

/** Returns the period's first and last day (inclusive) and its empty chart bars. A week has one bar per day, a month
 * one bar per week starting on Monday, and all time one bar per month. Week and month show their whole span so the bars
 * keep an even rhythm. `now` marks the bar that holds today, and `later` marks bars that are still to come. */
export function periodBars(p: Period, today: string, first = today): { from: string; to: string; bars: Bar[] } {
  const bar = (from: string, to: string, lbl: string, name: string): Bar => ({ label: lbl, name, from, to, total: 0, now: from <= today && today <= to, later: from > today });
  const bars: Bar[] = [];
  if (p === "week") {
    const from = addDays(today, -((toDate(today).getUTCDay() + 6) % 7));
    for (let k = from; k <= addDays(from, 6); k = addDays(k, 1)) bars.push(bar(k, k, label(k, { weekday: "short" }), label(k, { weekday: "long", month: "short", day: "numeric" })));
    return { from, to: addDays(from, 6), bars };
  }
  if (p === "all") {
    const from = first < today ? first : today;
    // ponytail: one bar per month. Group by year once accounts are older than about two years.
    for (let m = from.slice(0, 8) + "01"; m <= today; m = addDays(lastOfMonth(m), 1)) {
      bars.push(bar(m, lastOfMonth(m), label(m, { month: "short" }), label(m, { month: "long", year: "numeric" })));
    }
    return { from, to: today, bars };
  }
  const from = p === "month" ? today.slice(0, 8) + "01" : addDays(today.slice(0, 8) + "01", -1).slice(0, 8) + "01";
  const to = lastOfMonth(from);
  for (let k = from; k <= to; ) {
    const end = [addDays(k, 6 - ((toDate(k).getUTCDay() + 6) % 7)), to].sort()[0]; // the Sunday, or the period's last day
    bars.push(bar(k, end, label(k, { month: "short", day: "numeric" }), `${label(k, { month: "short", day: "numeric" })} to ${label(end, { day: "numeric" })}`));
    k = addDays(end, 1);
  }
  return { from, to, bars };
}

/** Adds each amount to the bar whose days hold its key. Sums in cents so totals are exact. */
export function fill(bars: Bar[], items: { key: string; amount: number }[]): Bar[] {
  const cents = bars.map(() => 0);
  for (const { key, amount } of items) {
    const i = bars.findIndex((b) => b.from <= key && key <= b.to);
    if (i >= 0) cents[i] += Math.round(amount * 100);
  }
  return bars.map((b, i) => ({ ...b, total: cents[i] / 100 }));
}

/** Round y-axis gridlines from $0 up past `max`. It picks 3 or 4 lines with the lowest top line that fits, on steps
 *  of 1, 2, 2.5 or 5 times a power of ten. */
export function ticks(max: number): number[] {
  const pow = 10 ** Math.floor(Math.log10(Math.max(max, 1) / 3));
  const n = (st: number) => Math.max(2, Math.ceil(max / st)); // intervals
  const step = [1, 2, 2.5, 5, 10, 20].map((m) => m * pow).filter((st) => n(st) <= 3).sort((a, b) => a * n(a) - b * n(b))[0]; // the lowest top line
  return Array.from({ length: n(step) + 1 }, (_, i) => i * step);
}
