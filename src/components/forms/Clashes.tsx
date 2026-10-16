"use client";
// Before saving new hours, list upcoming bookings that no longer fit. They stay booked; the Buddy decides.
import Link from "next/link";
import type { JobBooking } from "@/lib/types";
import { dayLabel, hm, serviceOf, slotMin, ymd } from "@/components/job/when";
import s from "./forms.module.css";

export type Clash = { b: JobBooking; why: string };

export function Clashes({ list, busy, onSave, onKeep }: { list: Clash[]; busy: boolean; onSave: () => void; onKeep: () => void }) {
  return (
    <div className={`box ${s.clash}`} role="alert">
      <p><b>{list.length === 1 ? "1 booking falls" : `${list.length} bookings fall`} outside your new hours.</b> They stay booked. Open each one to keep it or cancel it.</p>
      <ul>
        {list.map(({ b, why }) => (
          <li key={b._id}>
            <Link href={`/jobs?tab=${b.status === 1 ? "requests" : "upcoming"}&id=${b._id}`}>
              {serviceOf(b)}, {dayLabel(ymd(b.scheduledDate))}, {hm(slotMin(b.selectedSlot))}
            </Link>
            <small>{why}</small>
          </li>
        ))}
      </ul>
      <div className={s.clashActions}>
        <button type="button" className="btn p lg" onClick={onSave} disabled={busy} aria-busy={busy}>Save anyway</button>
        <button type="button" className="btn lg" onClick={onKeep}>Keep editing</button>
      </div>
    </div>
  );
}
