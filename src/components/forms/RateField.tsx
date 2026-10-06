"use client";
import type { CSSProperties } from "react";
import { money } from "@/lib/format";
import { Req } from "./Field";
import s from "./forms.module.css";

const MIN = 15, MAX = 250; // the slider's range; the exact box takes $1 to $1,000 (server rule, see rateError)
const whole = (n: number) => money(n).slice(0, -3); // "$85.00" to "$85"

/**
 * Hourly rate: a slider for the usual range plus a small box for the exact figure. The box owns the id (so the
 * label, errors and "first wrong field" focus land on it); the slider follows it and is pinned at an end outside $15 to $250.
 */
export function RateField({ id, value, onChange, error, hint, optional }: { id: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; optional?: boolean }) {
  const n = /^\d+$/.test(value) ? +value : NaN;
  const pos = Math.min(MAX, Math.max(MIN, Number.isNaN(n) ? MIN : n));
  const described = [`${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ");
  return (
    <div className={`field ${s.rate}`}>
      <div className={s.rateHead}>
        <label id={`${id}-label`} className={s.label} htmlFor={id}>Hourly rate{!optional && <Req />}</label>
        <output htmlFor={id} className={s.rateNow}>
          {Number.isNaN(n) ? "Not set" : <>{whole(n)} <small>/ hr</small></>}
        </output>
      </div>
      <input type="range" className={s.range} min={MIN} max={MAX} step={1} value={pos}
        style={{ "--f": (pos - MIN) / (MAX - MIN) } as CSSProperties}
        aria-labelledby={`${id}-label`} aria-valuetext={Number.isNaN(n) ? "Not set" : `${whole(n)} per hour`} aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)} />
      <div className={s.scale} aria-hidden><span>{whole(MIN)}</span><span>{whole(MAX)}</span></div>
      <div className={s.exact}>
        <span className={s.money}>
          <b aria-hidden>$</b>
          <input id={id} className="input" inputMode="numeric" autoComplete="off" maxLength={4} required={!optional} aria-required={!optional}
            value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
            aria-invalid={error ? true : undefined} aria-describedby={described} />
        </span>
        <small id={`${id}-hint`} className="hint">{hint ?? "Drag the slider, or type an exact rate from $1 to $1,000."}</small>
      </div>
      {error && <small id={`${id}-err`} className="err">{error}</small>}
    </div>
  );
}
