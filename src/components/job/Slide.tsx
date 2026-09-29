"use client";
import { useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import s from "./JobActions.module.css";

// Slide to confirm: drag the knob to the end. Enter or Space on the knob (a keyboard or assistive-tech click) does the same.
export function Slide({ label, onDone, busy }: { label: string; onDone: () => void; busy?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (busy) return;
    const max = (track.current?.clientWidth ?? 0) - 56, x0 = e.clientX;
    let d = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(true);
    const el = e.currentTarget;
    const move = (ev: PointerEvent) => { d = Math.max(0, Math.min(max, ev.clientX - x0)); setDx(d); };
    const up = () => {
      el.removeEventListener("pointermove", move);
      setDrag(false);
      setDx(0);
      if (d > max * 0.85) onDone();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up, { once: true });
    el.addEventListener("pointercancel", up, { once: true });
  };

  return (
    <div ref={track} className={`${s.slide} ${drag ? s.drag : ""}`} aria-busy={busy}>
      <span className={s.fill} style={{ width: dx + 56 }} />
      <span className={s.slideTxt}>{busy ? "Sending the code" : label}</span>
      <button
        type="button"
        className={s.knob}
        style={{ transform: `translateX(${dx}px)` }}
        aria-label={`${label}. Slide, or press Enter.`}
        disabled={busy}
        onPointerDown={down}
        onClick={(e) => { if (e.detail === 0) onDone(); }}
      >
        <ArrowRight size={20} aria-hidden />
      </button>
    </div>
  );
}
