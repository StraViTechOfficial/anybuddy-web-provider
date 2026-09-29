"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { money } from "@/lib/format";
import type { Bar } from "./period";
import s from "./earnings.module.css";

// Earned per bar. Hover, tap, focus or arrow keys pick a bar and show its amount; a hidden table reads the same figures.
export function Chart({ bars, title }: { bars: Bar[]; title: string }) {
  const found = bars.findLastIndex((b) => b.total > 0);
  const latest = found < 0 ? bars.length - 1 : found; // the latest bar with money, else the current one
  const [sel, setSel] = useState(latest);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => setSel(latest), [latest, title]);
  const max = Math.max(...bars.map((b) => b.total), 1);
  const move = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = Math.min(bars.length - 1, Math.max(0, sel + step));
    setSel(i);
    refs.current[i]?.focus();
  };
  return (
    <>
      <div className={s.chart} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }} onKeyDown={move} role="group" aria-label={`${title}, one bar each. Arrow keys move between bars.`}>
        {bars.map((b, i) => (
          <button
            key={b.from}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            className={s.col}
            aria-pressed={sel === i}
            aria-label={`${b.name}: ${money(b.total)}`}
            tabIndex={sel === i ? 0 : -1}
            onClick={() => setSel(i)}
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
          >
            <span className={s.bar} style={{ height: `${Math.max(2, (b.total / max) * 100)}%` }}>
              {sel === i && <span className={s.val} aria-hidden>{money(b.total)}</span>}
            </span>
          </button>
        ))}
      </div>
      <div className={s.cx} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }} aria-hidden>
        {bars.map((b) => <span key={b.from}>{b.label}</span>)}
      </div>
      <table className="sr">
        <caption>{title}</caption>
        <tbody>{bars.map((b) => <tr key={b.from}><th scope="row">{b.name}</th><td>{money(b.total)}</td></tr>)}</tbody>
      </table>
    </>
  );
}
