"use client";
import { useEffect, useState } from "react";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { Availability, JobBooking } from "@/lib/types";
import { fit, ymd } from "./when";
import s from "./JobActions.module.css";

// Fit check for a request: the Buddy's hours, break and days off, and confirmed jobs that day.
export function Fit({ b }: { b: JobBooking }) {
  const [res, setRes] = useState<ReturnType<typeof fit> | null>(null);
  const date = ymd(b.scheduledDate);
  const key = `${b._id} ${b.selectedSlot} ${b.timeInterval}`; // the parent hands a new object every second; refetch only on change
  useEffect(() => {
    Promise.all([
      api<Availability>("vendor/auth/get-profile-details", { query: { type: 2 } }),
      api<JobBooking[]>("vendor/bookings/list-day-wise", { method: "PUT", query: { date } }),
    ]).then(([a, d]) => setRes(fit(b, a.data, d.data))).catch(() => setRes(null));
  }, [key, date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!res) return null;
  const [k, msg] = res;
  return (
    <p className={`${s.fit} ${k === "ok" ? s.ok : s.warn}`}>
      {k === "ok" ? <CheckCircle size={20} weight="fill" aria-hidden /> : <Warning size={20} aria-hidden />}
      <span>{msg}</span>
    </p>
  );
}
