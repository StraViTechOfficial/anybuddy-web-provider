"use client";
import { useEffect, useState } from "react";
import { countdown, elapsed, TZ } from "@/lib/format";
import type { BookingStatus, Job } from "@/lib/types";

export const TABS: [string, string, BookingStatus][] = [
  ["requests", "Requests", 1],
  ["upcoming", "Upcoming", 2],
  ["done", "Done", 3],
  ["cancelled", "Canceled", 4],
];
export const tabOf = (status: BookingStatus) => TABS.find((t) => t[2] === status)![0];

/** Ticks every second while `live`, for countdowns and elapsed timers. */
export function useNow(live = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  return now;
}

export const service = (j: Job) => j.services?.serviceName || j.categoryName || "Job";
export const hours = (j: Job) => {
  const n = Number(j.timeInterval) || 1;
  return `${n} hr${n === 1 ? "" : "s"}`;
};
/** The town part of "12 Main St, Brooklyn, NY 11201" (the street stays in the detail). */
export const area = (j: Job) => {
  const parts = (j.address || "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts[1] || parts[0] || "";
};

import { cancelLabel } from "@/lib/format";
export { cancelLabel };

export function JobTag({ job, now }: { job: Job; now: number }) {
  const at = (d?: string | null) => (d ? new Date(d).getTime() : 0);
  if (job.status === 1)
    return job.expiresAt
      ? <span className="tag t-wait">Expires in {countdown(at(job.expiresAt) - now)}</span>
      : <span className="tag t-wait">Request</span>;
  if (job.status === 2) {
    if (job.checkInAt) return <span className="tag t-info">In progress {elapsed(now - at(job.checkInAt))}</span>;
    if (job.onTheWayAt) return <span className="tag t-info">On the way{job.etaMinutes ? `, ${job.etaMinutes} min` : ""}</span>;
    return <span className="tag t-ok">Confirmed</span>;
  }
  if (job.status === 3) return <span className="tag t-ok">Done</span>;
  return <span className="tag t-bad">{cancelLabel(job)}</span>;
}

// Business-day keys (YYYY-MM-DD in New York) for grouping upcoming jobs.
const key = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
const dayNo = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 864e5;

export function group(scheduled: string, now: number) {
  const today = key(new Date(now));
  const diff = dayNo(key(scheduled)) - dayNo(today);
  if (diff <= 0) return "Today"; // a confirmed job from an earlier day is still open work
  if (diff === 1) return "Tomorrow";
  const weekday = new Date(dayNo(today) * 864e5).getUTCDay() || 7; // Mon 1 .. Sun 7
  return diff <= 7 - weekday ? "This week" : "Later";
}
