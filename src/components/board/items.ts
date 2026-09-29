// Board items: every request and job on the visible business days, placed by start minute and length.
import type { JobBooking } from "@/lib/types";
import { bookedHours, slotMin, ymd } from "@/components/job/when";

export const H0 = 7 * 60, H1 = 19 * 60; // the grid runs 07:00 to 19:00
export type Kind = "req" | "progress" | "onway" | "confirmed" | "done" | "cancelled";
export type Item = { b: JobBooking; day: number; s: number; e: number; kind: Kind; half?: "a" | "b" };

export const kindOf = (b: JobBooking): Kind =>
  b.status === 1 ? "req" : b.status === 3 ? "done" : b.status === 4 ? "cancelled" : b.checkInAt ? "progress" : b.onTheWayAt ? "onway" : "confirmed";

export function boardItems(list: JobBooking[], days: string[]): Item[] {
  const out = list.flatMap((b) => {
    const day = days.indexOf(ymd(b.scheduledDate));
    if (day < 0) return [];
    const s = slotMin(b.selectedSlot);
    return [{ b, day, s, e: s + bookedHours(b) * 60, kind: kindOf(b) } as Item];
  });
  // A request over a job splits the row: request on top, job below.
  for (const r of out) if (r.kind === "req")
    for (const j of out) if (j.kind !== "req" && j.day === r.day && r.s < j.e && j.s < r.e) { r.half = "a"; j.half = "b"; }
  return out.sort((a, b) => a.day - b.day || a.s - b.s);
}

/** Default focus, within the visible days: job in progress, then on the way, then the most urgent request,
 *  then the next job today, then the first job shown. `today` is today's row index (-1 when not shown). */
export function pickDefault(items: Item[], nowMin: number, today: number) {
  const t = items.filter((x) => x.day === today);
  return (
    t.find((x) => x.kind === "progress")?.b._id ??
    t.find((x) => x.kind === "onway")?.b._id ??
    urgent(items.filter((x) => x.kind === "req").map((x) => x.b))[0]?._id ??
    (t.find((x) => x.kind === "confirmed" && x.e > nowMin) ?? t.find((x) => x.kind === "confirmed"))?.b._id ??
    items.find((x) => x.day >= today && x.kind !== "cancelled")?.b._id
  );
}

export const urgent = (requests: JobBooking[]) =>
  [...requests].sort((a, b) => Date.parse(a.expiresAt ?? "9999") - Date.parse(b.expiresAt ?? "9999"));
