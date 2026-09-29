"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { money } from "@/lib/format";
import { ticks, type Bar } from "./period";
import s from "./chart.module.css";

const axis = (n: number) => money(n).replace(/\.00$/, ""); // "$250", "$2.50"

// Earned per bar on a $0-based axis. Today's bar is in the brand colour, the rest quieter.
// Hover, tap, focus or arrow keys show a bar's amount; the latest amount is written above its bar; a hidden table reads the same figures.
export function Chart({ bars, title }: { bars: Bar[]; title: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (!bars.some((b) => b.total > 0)) return <p className={s.empty}>No finished jobs in this period.</p>;

  const latest = bars.findLastIndex((b) => b.total > 0);
  const t = ticks(Math.max(...bars.map((b) => b.total)));
  const top = t[t.length - 1];
  const pct = (n: number) => `${(n / top) * 100}%`;
  const focusable = sel ?? latest;
  const days = bars[0].from === bars[0].to; // the week view: weekday initials on phones
  const thin = bars.length > 7; // phones keep every other month label, counting back from the latest
  const move = (e: KeyboardEvent) => {
    const i = ({ ArrowRight: focusable + 1, ArrowLeft: focusable - 1, Home: 0, End: bars.length - 1 } as Record<string, number>)[e.key];
    if (i === undefined) return;
    e.preventDefault();
    const j = Math.min(bars.length - 1, Math.max(0, i));
    setSel(j);
    refs.current[j]?.focus();
  };

  return (
    <div className={s.chart}>
      <div className={s.y} aria-hidden>
        <b>{axis(top)}</b>{/* sizes the axis column */}
        {t.map((v) => <span key={v} style={{ bottom: pct(v) }}>{axis(v)}</span>)}
      </div>
      <div className={s.plot}>
        {t.map((v) => <i key={v} className={s.grid} style={{ bottom: pct(v) }} />)}
        <div className={s.cols} onKeyDown={move} onMouseLeave={() => setSel(null)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setSel(null)} role="group" aria-label={`${title}. Arrow keys move between bars.`}>
          {bars.map((b, i) => (
            <button
              key={b.from}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              className={s.col}
              data-now={b.now || undefined}
              aria-pressed={sel === i}
              aria-label={`${b.name}${b.now ? ", now" : ""}: ${b.later ? "still to come" : money(b.total)}`}
              tabIndex={focusable === i ? 0 : -1}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
            >
              <span className={s.bar} style={{ height: b.total ? pct(b.total) : 0 }}>
                {sel === i ? (
                  <span className={s.tip} aria-hidden><small>{b.name}</small>{b.later ? "Still to come" : money(b.total)}</span>
                ) : i === latest && sel === null ? (
                  <span className={s.val} aria-hidden>{money(b.total)}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.x} aria-hidden>
        {bars.map((b, i) => (
          <span key={b.from} data-now={b.now || undefined} data-skip={thin && (bars.length - 1 - i) % 2 ? "" : undefined}>
            <span className={s.long}>{b.label}</span>
            <span className={s.short}>{days ? b.label[0] : b.label}</span>
          </span>
        ))}
      </div>
      <table className="sr">
        <caption>{title}</caption>
        <tbody>{bars.filter((b) => !b.later).map((b) => <tr key={b.from}><th scope="row">{b.name}</th><td>{money(b.total)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
