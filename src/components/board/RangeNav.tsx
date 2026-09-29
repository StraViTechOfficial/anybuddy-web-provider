"use client";
// One line above the board: Today, previous/next range, go to a date, and the visible range as text.
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { isDayKey, shortDay } from "@/components/job/when";
import { DatePicker } from "@/components/ui/DatePicker";
import s from "./Board.module.css";
import n from "./RangeNav.module.css";

export function RangeNav({ days, isToday, unit, go, className = "" }: {
  days: string[]; isToday: boolean; unit: string; go: (from: string | 0 | 1 | -1) => void; className?: string;
}) {
  return (
    <div className={`${s.nav} ${className}`}>
      <button type="button" className="btn" onClick={() => go(0)} aria-pressed={isToday}>Today</button>
      <button type="button" className={`btn ${s.icon}`} onClick={() => go(-1)} aria-label={`Previous ${unit}`}><CaretLeft size={20} aria-hidden /></button>
      <button type="button" className={`btn ${s.icon}`} onClick={() => go(1)} aria-label={`Next ${unit}`}><CaretRight size={20} aria-hidden /></button>
      <DatePicker className={n.goto} label="Go to date" hideLabel value={days[0]} onChange={(v) => isDayKey(v) && go(v)} />
      <p className={s.range} aria-live="polite">{shortDay(days[0])} to {shortDay(days[days.length - 1])}</p>
    </div>
  );
}
