"use client";
// A date field with a month grid anchored under it (the WAI-ARIA date picker dialog pattern). Values are calendar days
// as "YYYY-MM-DD", and all date math runs at noon UTC so no time zone can shift a day. "Today" is the New York day.
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { dayKey } from "@/lib/format";
import { createPortal } from "react-dom";
import { usePopup } from "./usePopup";
import s from "./picker.module.css";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const utc = (k: string) => new Date(k + "T12:00:00Z");
const key = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (k: string, n: number) => { const d = utc(k); d.setUTCDate(d.getUTCDate() + n); return key(d); };
const addMonths = (k: string, n: number) => {
  const d = utc(k.slice(0, 8) + "01");
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(+k.slice(8), last));
  return key(d);
};
const us = (k: string) => `${k.slice(5, 7)}/${k.slice(8)}/${k.slice(0, 4)}`;
const long = (k: string, o: Intl.DateTimeFormatOptions) => utc(k).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

export type PickerProps = {
  value: string; onChange: (v: string) => void; min?: string; max?: string;
  label: string; hideLabel?: boolean; id?: string; disabled?: boolean; invalid?: boolean; describedBy?: string; className?: string;
};

export function DatePicker({ value, onChange, min, max, label, hideLabel, id, disabled, invalid, describedBy, className = "" }: PickerProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(value || dayKey());
  const field = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const toGrid = useRef(false); // move DOM focus into the grid on open and on grid keys, not on month-button clicks
  const close = useCallback(() => setOpen(false), []);
  const pop = usePopup(open, close);

  const clamp = (k: string) => (min && k < min ? min : max && k > max ? max : k);
  const off = (k: string) => Boolean((min && k < min) || (max && k > max));

  useEffect(() => {
    if (!open || !toGrid.current) return;
    toGrid.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [open, focus]);

  function toggle() {
    if (!open) { setFocus(clamp(value || dayKey())); toGrid.current = true; }
    setOpen(!open);
  }
  function done(k?: string) {
    if (k) onChange(k);
    setOpen(false);
    field.current?.focus();
  }

  function keys(e: KeyboardEvent) {
    const wd = utc(focus).getUTCDay();
    const move: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1), PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -wd), End: () => addDays(focus, 6 - wd),
    };
    if (move[e.key]) { e.preventDefault(); toGrid.current = true; setFocus(clamp(move[e.key]())); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!off(focus)) done(focus); }
  }

  // The visible month: blanks before the 1st, then each day.
  const first = focus.slice(0, 8) + "01";
  const lead = utc(first).getUTCDay();
  const count = new Date(Date.UTC(+focus.slice(0, 4), +focus.slice(5, 7), 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const today = dayKey();
  const month = long(first, { month: "long", year: "numeric" });
  const prevOff = Boolean(min && addDays(first, -1) < min);
  const nextOff = Boolean(max && addMonths(first, 1) > max);

  return (
    <div ref={pop.root} className={`${s.wrap} ${className}`}
      onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); done(); } }}>
      <span id={`${fieldId}-l`} className={hideLabel ? "sr" : s.label}>{label}</span>
      <button ref={field} id={fieldId} type="button" className={`${s.field} ${s.start}`} disabled={disabled} onClick={toggle}
        aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${fieldId}-l ${fieldId}`}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        <CalendarBlank size={20} aria-hidden />
        <span className={value ? undefined : s.empty}>{value ? us(value) : "MM/DD/YYYY"}</span>
      </button>
      {open && createPortal(
        <div ref={pop.panel} style={pop.style} className={`${s.panel} ${s.cal}`} role="dialog" aria-label={`${label}, choose a date`}>
          <div className={s.calHead}>
            <button type="button" className={s.nav} onClick={() => setFocus(clamp(addMonths(focus, -1)))} disabled={prevOff} aria-label="Previous month">
              <CaretLeft size={20} aria-hidden />
            </button>
            <b aria-live="polite">{month}</b>
            <button type="button" className={s.nav} onClick={() => setFocus(clamp(addMonths(focus, 1)))} disabled={nextOff} aria-label="Next month">
              <CaretRight size={20} aria-hidden />
            </button>
          </div>
          <table ref={grid} role="grid" aria-label={month} className={s.grid} onKeyDown={keys}>
            <thead><tr>{WEEK.map((d, i) => <th key={d} scope="col" abbr={WEEK_FULL[i]}>{d.slice(0, 2)}</th>)}</tr></thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={i}>
                  {w.map((k, j) => (
                    <td key={j} aria-selected={k ? k === value : undefined}>
                      {k && (
                        <button type="button" data-day={k} tabIndex={k === focus ? 0 : -1} disabled={off(k)}
                          className={s.dayBtn} aria-current={k === today ? "date" : undefined}
                          aria-label={long(k, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                          onClick={() => done(k)} onFocus={() => setFocus(k)}>
                          {+k.slice(8)}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.calFoot}>
            <button type="button" className="btn" disabled={off(today)} onClick={() => done(today)}>Today</button>
            <button type="button" className="btn" onClick={() => done()}>Close</button>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
