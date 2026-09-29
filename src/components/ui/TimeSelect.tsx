"use client";
// Time field: the shared Select with US 12-hour labels. Values are backend "HH:mm" (24-hour).
import { clock } from "@/lib/format";
import { Select, type SelectProps } from "./Select";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const mins = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + (m || 0); };

/** Type-ahead: "9" → 9:00 AM, "93" → 9:30 AM, "1p" → 1:00 PM, "1030" → 10:30 AM. Returns an index or -1. */
export function typeMatch(opts: string[], typed: string) {
  const m = /^(\d{1,4})\s*([ap])?/.exec(typed.toLowerCase());
  if (!m) return -1;
  const d = m[1];
  const [h, rest] = d.length <= 2 && +d <= 12 ? [+d, ""] : d.length >= 3 && +d.slice(0, 2) <= 12 ? [+d.slice(0, 2), d.slice(2)] : [+d[0], d.slice(1)];
  return opts.findIndex((v) => {
    const t = mins(v), h12 = Math.floor(t / 60) % 12 || 12;
    return h12 === h && String(t % 60).padStart(2, "0").startsWith(rest) && (!m[2] || (t < 720) === (m[2] === "a"));
  });
}

export function TimeSelect({ min = "00:00", max = "23:30", step = 30, value, ...rest }:
  Omit<SelectProps, "options" | "match"> & { min?: string; max?: string; step?: number }) {
  const opts: string[] = [];
  for (let t = mins(min); t <= mins(max); t += step) opts.push(hhmm(t));
  if (value && !opts.includes(value)) opts.push(value), opts.sort(); // a saved off-grid time stays choosable
  return <Select block={false} {...rest} value={value} placeholder="Choose a time" options={opts.map((v) => ({ value: v, label: clock(v) }))}
    match={(typed) => typeMatch(opts, typed)} />;
}
