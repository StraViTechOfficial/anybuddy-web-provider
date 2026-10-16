"use client";
// Where a booking sits in business time (America/New_York): its day, start minute and length.
import { useEffect, useState } from "react";
import { dayKey, TZ } from "@/lib/format";
import type { Availability, JobBooking } from "@/lib/types";

const hmFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The business-day key, such as "2026-09-29". The backend stores scheduledDate as that day's midnight in New York. */
export const ymd = (d: string | Date) => dayKey(d);
/** A calendar day, used for leave dates. "2026-10-09" and "2026-10-09T00:00:00Z" both mean Oct 9, never shifted by
 *  time zones. */
export const calDay = (d: string) => String(d).slice(0, 10);
/** Minutes since business midnight. */
export const minuteOf = (d: Date) => {
  const [h, m] = hmFmt.format(d).split(":").map(Number);
  return h * 60 + m + d.getSeconds() / 60;
};
export const slotMin = (slot: string) => {
  const [h, m] = (slot || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
};
import { clockMin } from "@/lib/format";
export const hm = clockMin; // one clock for the whole app (US 12-hour)
export const bookedHours = (b: JobBooking) => Number(b.timeInterval) || 1;

/** The weekday of a day key, where 0 is Sunday (as in the backend's availability.day). */
export const weekday = (key: string) => new Date(key + "T12:00:00Z").getUTCDay();
export const dayLabel = (key: string) =>
  new Date(key + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

/** Milliseconds from now until the booking starts (negative once due). */
export const msUntil = (b: JobBooking, now = new Date()) => {
  const days = (Date.parse(ymd(b.scheduledDate)) - Date.parse(ymd(now))) / 864e5;
  return (days * 1440 + slotMin(b.selectedSlot) - minuteOf(now)) * 6e4;
};

/** Re-renders every `ms` so clocks, countdowns and the now line stay live. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const serviceOf = (b: JobBooking) => b.services?.serviceName || b.serviceName || b.categoryName || "Job";

/** A day's working window in minutes, or closed (weekly day off or a leave). */
export function openHours(a: Availability | null, key: string) {
  if (!a) return null;
  if (a.leaves?.some((l) => calDay(l.date) === key)) return { closed: "leave" as const };
  const d = a.availability.find((x) => x.day === weekday(key));
  if (!d?.isOpen || !d.from || !d.to) return { closed: "weekly" as const };
  const brk = a.breakStart && a.breakEnd ? [slotMin(a.breakStart), slotMin(a.breakEnd)] : null;
  return { closed: false as const, from: slotMin(d.from), to: slotMin(d.to), brk };
}

/** Fit check for a request against hours, break and confirmed jobs that day. */
export function fit(req: JobBooking, a: Availability | null, jobs: JobBooking[]): ["ok" | "warn", string] {
  const key = ymd(req.scheduledDate), s = slotMin(req.selectedSlot), e = s + bookedHours(req) * 60;
  const o = openHours(a, key);
  if (o?.closed === "leave") return ["warn", `${dayLabel(key)} is marked as a day off.`];
  if (o?.closed === "weekly") return ["warn", `${dayLabel(key).split(",")[0]} is outside your working days.`];
  const clash = jobs.find((j) => j._id !== req._id && j.status === 2 && ymd(j.scheduledDate) === key
    && slotMin(j.selectedSlot) < e && s < slotMin(j.selectedSlot) + bookedHours(j) * 60);
  if (clash) return ["warn", `Clashes with ${serviceOf(clash)} at ${hm(slotMin(clash.selectedSlot))}.`];
  if (o && (s < o.from || e > o.to)) return ["warn", `Outside your hours (${hm(o.from)} to ${hm(o.to)}).`];
  if (o?.brk && s < o.brk[1] && o.brk[0] < e) return ["warn", `Runs into your break (${hm(o.brk[0])} to ${hm(o.brk[1])}).`];
  return ["ok", `Fits. You are free ${hm(s)} to ${hm(e)}.`];
}

/** Day key `n` days after `key` (negative goes back). */
export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
};
export const daysFrom = (key: string, n: number) => Array.from({ length: n }, (_, i) => addDays(key, i));
/** "Sep 29" */
export const shortDay = (key: string) =>
  new Date(key + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
export const isDayKey = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
