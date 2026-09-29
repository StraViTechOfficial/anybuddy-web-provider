"use client";
// Select field + anchored listbox (WAI-ARIA select-only combobox). Replaces every native <select> (owner, 29 Sep).
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { usePopup } from "./usePopup";
import s from "./picker.module.css";

export type Option = { value: string; label: string; disabled?: boolean; hint?: string };
export type SelectProps = {
  value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string;
  label: string; hideLabel?: boolean; id?: string; disabled?: boolean; invalid?: boolean; describedBy?: string; className?: string;
  /** Type-ahead rule; the default finds the first label starting with the typed text. */
  match?: (typed: string) => number;
};

export function Select({ value, onChange, options, placeholder = "Choose", label, hideLabel, id, disabled, invalid, describedBy, className = "", match, block = true }: SelectProps & { block?: boolean }) {
  const auto = useId();
  const fieldId = id ?? auto;
  const listId = `${fieldId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const close = useCallback(() => setOpen(false), []);
  const pop = usePopup(open, close, block);
  const cur = options.findIndex((o) => o.value === value);
  const shown = options[cur];

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /** The nearest enabled option from i in direction dir (1 or -1); stays put at the ends. */
  const usable = (i: number, dir: number) => {
    for (let j = Math.max(0, Math.min(options.length - 1, i)); j >= 0 && j < options.length; j += dir) if (!options[j].disabled) return j;
    return active;
  };
  function show(i = cur < 0 ? usable(0, 1) : cur) { setActive(i); setOpen(true); }
  function pick(i: number) { if (options[i] && !options[i].disabled) onChange(options[i].value); setOpen(false); }

  function keys(e: KeyboardEvent) {
    const last = options.length - 1, at = open ? active : Math.max(cur, 0);
    if (e.key.length !== 1) typed.current.text = ""; // any other key ends the typed run
    const go = (i: number) => { e.preventDefault(); if (open) setActive(i); else show(i); };
    if (e.key === "ArrowDown") return go(open ? usable(at + 1, 1) : usable(at, 1));
    if (e.key === "ArrowUp") return go(open ? usable(at - 1, -1) : usable(at, 1));
    if (e.key === "PageDown") return go(usable(at + 10, -1));
    if (e.key === "PageUp") return go(usable(at - 10, 1));
    if (e.key === "Home") return go(usable(0, 1));
    if (e.key === "End") return go(usable(last, -1));
    if (e.key === "Enter" || (e.key === " " && !typed.current.text)) { e.preventDefault(); return open ? pick(active) : show(); }
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); return setOpen(false); }
    if (e.key === "Tab" && open) return pick(active);
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const now = Date.now();
      const text = (now - typed.current.at < 800 ? typed.current.text : "") + e.key;
      typed.current = { text, at: now };
      const i = match ? match(text) : options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(text.toLowerCase()));
      if (i >= 0 && !options[i].disabled) go(i);
    }
  }

  return (
    <div ref={pop.root} className={`${s.wrap} ${block ? s.block : ""} ${className}`}>
      <span id={`${fieldId}-l`} className={hideLabel ? "sr" : s.label}>{label}</span>
      <button id={fieldId} type="button" role="combobox" className={s.field} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={`${fieldId}-l`}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={keys}>
        <span className={`${s.text} ${shown ? "" : s.empty}`}>{shown?.label ?? placeholder}</span>
        <CaretDown size={20} aria-hidden />
      </button>
      {open && createPortal(
        <div ref={pop.panel} style={pop.style} className={s.panel}>
          <ul ref={list} id={listId} role="listbox" aria-labelledby={`${fieldId}-l`} className={s.list}>
            {options.map((o, i) => (
              <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined}
                className={`${s.opt} ${i === active ? s.active : ""}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => !o.disabled && pick(i)} onMouseMove={() => i !== active && !o.disabled && setActive(i)}>
                <span>{o.label}{o.hint && <small className={s.hint}>{o.hint}</small>}</span>
              </li>
            ))}
          </ul>
        </div>
      , document.body)}
    </div>
  );
}
