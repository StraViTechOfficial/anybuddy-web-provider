"use client";
// One "Search address" box that shows Google suggestions while the Buddy types (a WAI-ARIA combobox with the list
// inline under the box). Picking one fills in the street, city, state, ZIP and exact point. It is rendered only when
// the Maps key is set.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { details, suggest, type Address } from "@/lib/google";
import s from "./forms.module.css";

type Hit = Awaited<ReturnType<typeof suggest>>[number];
/** On phones the box moves to the top of the screen, so the list under it stays above the on-screen keyboard. */
const toTop = (el: HTMLElement) => {
  if (matchMedia("(max-width: 699px)").matches) setTimeout(() => el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 300);
};

export function AddressSearch({ onPick, onFail, error }: { onPick: (a: Address) => void; onFail: (message: string) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(-1);
  const [note, setNote] = useState("");
  const asked = useRef("");
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => { if (hits.length) list.current?.scrollIntoView({ block: "nearest" }); }, [hits.length]);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) return setHits([]);
    const t = setTimeout(() => {
      asked.current = text;
      suggest(text).then((h) => { if (asked.current === text) { setHits(h); setActive(-1); } }, (e) => onFail(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, onFail]);

  async function pick(h: Hit) {
    setHits([]);
    setNote("");
    try {
      const a = await details(h.place);
      if (!a) return setNote("This place has no map point. Pick another address, or enter the address yourself.");
      setQ("");
      onPick(a);
    } catch (e) {
      onFail(e instanceof Error ? e.message : "Address suggestions didn't load. Enter your address below.");
    }
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!hits.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(hits[active]);
    } else if (e.key === "Escape") setHits([]);
  }

  const msg = note || error;
  return (
    <>
      <input id="address" className="input" role="combobox" aria-autocomplete="list" aria-expanded={hits.length > 0} aria-controls="address-list"
        aria-activedescendant={active >= 0 ? `address-${active}` : undefined} autoComplete="off" placeholder="Start typing your street address"
        value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} maxLength={120} onFocus={(e) => toTop(e.target)}
        aria-invalid={msg ? true : undefined} aria-describedby={msg ? "address-err" : "address-hint"} />
      {hits.length > 0 && (
        <ul ref={list} id="address-list" role="listbox" aria-label="Suggested addresses" className={s.suggest}>
          {hits.map((h, i) => (
            <li key={h.label} id={`address-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>{h.label}</li>
          ))}
        </ul>
      )}
      {msg && <small id="address-err" className="err">{msg}</small>}
    </>
  );
}
