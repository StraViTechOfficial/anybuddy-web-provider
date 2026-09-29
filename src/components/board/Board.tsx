"use client";
// Laptop (a week) and tablet (3 days): the visible days as rows on one 07:00 to 19:00 grid.
import type { CSSProperties } from "react";
import { countdown, elapsed, hourMark } from "@/lib/format";
import type { Availability } from "@/lib/types";
import { dayLabel, hm, openHours, serviceOf, shortDay } from "@/components/job/when";
import { H0, H1, type Item } from "./items";
import s from "./Board.module.css";

const SPAN = H1 - H0;
const pct = (m: number) => `${((Math.min(H1, Math.max(H0, m)) - H0) / SPAN) * 100}%`;
const TICKS = Array.from({ length: SPAN / 60 + 1 }, (_, i) => i);

/** One block. `vertical` = the phone agenda (64px per hour). */
export function Blk({ x, sel, onSel, now, vertical, past }: { x: Item; sel: boolean; onSel: () => void; now: Date; vertical?: boolean; past?: boolean }) {
  const s0 = Math.max(H0, x.s), e0 = Math.min(H1, Math.max(x.e, s0 + 30));
  const pos: CSSProperties = vertical
    ? { top: ((s0 - H0) / 60) * 64, height: ((e0 - s0) / 60) * 64 - 6 }
    : { left: pct(s0), width: `calc(${((e0 - s0) / SPAN) * 100}% - 4px)` };
  const name = serviceOf(x.b);
  const extra =
    x.kind === "req" && x.b.expiresAt ? countdown(Date.parse(x.b.expiresAt) - now.getTime())
    : x.kind === "progress" && x.b.checkInAt ? elapsed(now.getTime() - Date.parse(x.b.checkInAt))
    : x.kind === "onway" ? "On the way"
    : x.kind === "done" ? "Done" : x.kind === "cancelled" ? "Canceled" : "";
  return (
    <button
      type="button"
      className={`${s.blk} ${s[x.kind]} ${x.half ? s["half" + x.half] : ""} ${past || x.kind === "cancelled" ? s.muted : ""}`}
      style={pos}
      data-id={x.b._id}
      aria-pressed={sel}
      aria-label={`${{ req: "Request", progress: "In progress", onway: "On the way", confirmed: "Confirmed", done: "Done", cancelled: "Canceled" }[x.kind]}, ${name}, ${hm(x.s)}`} // no live timer: it would re-announce every second
      onClick={onSel}
    >
      <b>{name}</b>
      <small>{hm(x.s)}{extra && ` · ${extra}`}</small>
    </button>
  );
}

export function Board({ items, days, today, avail, sel, onSel, now, nowMin, unit }: {
  items: Item[]; days: string[]; today: string; avail: Availability | null;
  sel?: string; onSel: (id: string) => void; now: Date; nowMin: number; unit: string;
}) {
  return (
    <section className={`box ${s.lanes} ${days.length > 3 ? s.week : ""}`} aria-label={`Your ${unit}`}>
      <div className={s.axis} aria-hidden>
        <span />
        <div className={s.ticks}>{TICKS.map((i) => <span key={i} style={{ left: `${(i * 60 / SPAN) * 100}%` }}>{hourMark(7 + i)}</span>)}</div>
      </div>
      {days.map((d, i) => {
        const o = openHours(avail, d);
        return (
          <div key={d} className={s.lane}>
            <div className={`${s.lab} ${d < today ? s.pastLab : ""}`}>
              <b>{d === today ? "Today" : dayLabel(d).split(",")[0]}</b><small>{shortDay(d)}</small>
            </div>
            <div className={s.track}>
              {o?.closed ? <i className={s.off} style={{ left: 0, right: 0 }} /> : o && (
                <>
                  <i className={s.off} style={{ left: 0, width: pct(o.from) }} />
                  <i className={s.off} style={{ left: pct(o.to), right: 0 }} />
                  {o.brk && <i className={`${s.off} ${s.brk}`} style={{ left: pct(o.brk[0]), width: `calc(${pct(o.brk[1])} - ${pct(o.brk[0])})` }} />}
                </>
              )}
              {d === today && nowMin >= H0 && nowMin <= H1 && <i className={s.now} style={{ left: pct(nowMin) }}><em>{hm(nowMin)}</em></i>}
              {items.filter((x) => x.day === i).map((x) => (
                <Blk key={x.b._id} x={x} now={now} past={d < today} sel={sel === x.b._id} onSel={() => onSel(x.b._id)} />
              ))}
            </div>
          </div>
        );
      })}
      {!items.length && <p className={s.empty}>No jobs {days.length > 3 ? "this week" : "in these 3 days"}. Requests show here as soon as customers book you.</p>}
      <div className={s.legend}>
        <span><i className={`${s.lg} ${s.progress}`} />In progress</span>
        <span><i className={`${s.lg} ${s.confirmed}`} />Confirmed</span>
        <span><i className={`${s.lg} ${s.onway}`} />On the way</span>
        <span><i className={`${s.lg} ${s.req}`} />Request, dashed until you accept</span>
        <span><i className={`${s.lg} ${s.done} ${s.muted}`} />Past or canceled</span>
        <span><i className={`${s.lg} ${s.offl}`} />Closed or break</span>
        <span className={s.keys}>Keys: <kbd>←</kbd><kbd>→</kbd> move · <kbd>A</kbd> accept · <kbd>D</kbd> decline · <kbd>[</kbd><kbd>]</kbd> {unit}</span>
      </div>
    </section>
  );
}

