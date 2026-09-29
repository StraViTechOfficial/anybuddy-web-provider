"use client";
// Phone: requests to answer (all of them, most urgent first), then the range controls, a 7-day strip and a vertical
// agenda of the chosen day with the same blocks.
import { useState, type ReactNode } from "react";
import { countdown, hourMark } from "@/lib/format";
import type { Availability, JobBooking } from "@/lib/types";
import { dayLabel, hm, openHours, serviceOf, shortDay, slotMin, ymd } from "@/components/job/when";
import { Blk } from "./Board";
import { H0, H1, type Item } from "./items";
import s from "./Board.module.css";

const HOURS = Array.from({ length: (H1 - H0) / 60 }, (_, i) => i);
const y = (m: number) => ((Math.min(H1, Math.max(H0, m)) - H0) / 60) * 64;
// Closed hours and the break for one day, same shading as the laptop board.
function Shade({ avail, day }: { avail: Availability | null; day: string }) {
  const o = openHours(avail, day);
  if (!o) return null;
  const band = (a: number, b: number, cls: string) => b > a && <i key={cls + a} className={cls} style={{ top: y(a), height: y(b) - y(a), bottom: "auto", left: 0, right: 0 }} />;
  if (o.closed) return <>{band(H0, H1, s.off)}</>;
  return <>{band(H0, o.from, s.off)}{band(o.to, H1, s.off)}{o.brk && band(o.brk[0], o.brk[1], `${s.off} ${s.brk}`)}</>;
}

export function Agenda({ items, avail, requests, days, today, sel, onSel, now, nowMin, nav }: {
  avail: Availability | null;
  items: Item[]; requests: JobBooking[]; days: string[]; today: string;
  sel?: string; onSel: (id: string) => void; now: Date; nowMin: number; nav: ReactNode;
}) {
  const [pick, setPick] = useState(today);
  // The chosen day, else today when shown, else the first day of the range (after Go to date or next/previous).
  const day = days.includes(pick) ? pick : days.includes(today) ? today : days[0];
  const onDay = items.filter((x) => x.day === days.indexOf(day));
  return (
    <section className={s.mob} aria-label="Day agenda">
      {requests.length > 0 && (
        <>
          <h2>Requests to answer</h2>
          <div className={`box ${s.rq}`}>
            {requests.map((r) => {
              const k = ymd(r.scheduledDate);
              return (
                <button key={r._id} type="button" data-id={r._id} className={s.rqrow} aria-pressed={sel === r._id} onClick={() => onSel(r._id)}>
                  <span>
                    <b>{serviceOf(r)}</b>
                    <small>{k === today ? "Today" : dayLabel(k)}, {hm(slotMin(r.selectedSlot))}</small>
                  </span>
                  {r.expiresAt && <span className="tag t-wait">{countdown(Date.parse(r.expiresAt) - now.getTime())}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <h2>Your days</h2>
      {nav}
      <div className={s.strip} role="group" aria-label="Day">
        {days.map((d, n) => {
          const on = items.filter((x) => x.day === n), job = on.some((x) => x.kind !== "req"), req = on.some((x) => x.kind === "req");
          return (
            <button key={d} type="button" aria-pressed={d === day} className={d < today ? s.pastDay : ""} onClick={() => setPick(d)}
              aria-label={`${d === today ? "Today, " : ""}${dayLabel(d)}${job ? ", has jobs" : ""}${req ? ", has requests" : ""}`}>
              <small>{d === today ? "Today" : dayLabel(d).slice(0, 3)}</small>
              <b>{shortDay(d).split(" ")[1]}</b>
              <span className={s.dots} aria-hidden>{job && <i className={s.jdot} />}{req && <i className={s.rdot} />}</span>
            </button>
          );
        })}
      </div>
      {!onDay.length && <p className={`muted ${s.dayEmpty}`}>No jobs on {dayLabel(day)}. Requests show here as soon as customers book you.</p>}
      <div className={`box ${s.agenda}`}>
        <div aria-hidden>{HOURS.map((h) => <span key={h} className={s.hr} style={{ top: h * 64 }}>{hourMark(7 + h)}</span>)}</div>
        <div className={s.vtrack}>
          <Shade avail={avail} day={day} />
          {day === today && nowMin >= H0 && nowMin <= H1 && <i className={s.vnow} style={{ top: ((nowMin - H0) / 60) * 64 }} />}
          {onDay.map((x) => (
            <Blk key={x.b._id} x={x} vertical past={day < today} now={now} sel={sel === x.b._id} onSel={() => onSel(x.b._id)} />
          ))}
        </div>
      </div>
    </section>
  );
}
