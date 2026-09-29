"use client";
// One rule for the anchored pickers: close on outside press or focus leaving, and place the panel with
// position: fixed in a portal on <body>, so no overflow: hidden or transformed box can clip or move it. It opens below the field, flips above when there is
// no room, never sits under the sticky top bar or the phone tab bar, and stays inside the viewport width.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/** Bottom of sticky/fixed bars at the top, top of those at the bottom (the phone tab bar). */
function bars() {
  let top = 0, bottom = window.innerHeight;
  for (const el of document.querySelectorAll<HTMLElement>("header, nav")) {
    const c = getComputedStyle(el);
    if ((c.position !== "sticky" && c.position !== "fixed") || !el.offsetParent) continue;
    const r = el.getBoundingClientRect();
    if (c.bottom === "0px" && r.top > window.innerHeight / 2) bottom = Math.min(bottom, r.top);
    else if (c.top === "0px" && r.bottom < window.innerHeight / 2) top = Math.max(top, r.bottom);
  }
  return { top: top + 8, bottom: bottom - 8 };
}

export function usePopup(open: boolean, close: () => void, fullWidth = false) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    // The panel is portalled to <body>, so "inside" means the field's wrapper or the panel.
    const away = (e: Event) => {
      const n = e.target as Node;
      if (!root.current?.contains(n) && !panel.current?.contains(n)) close();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("focusin", away);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("focusin", away); };
  }, [open, close]);

  const place = useCallback((scrollIfNeeded: boolean) => {
    const field = root.current?.querySelector("button"), p = panel.current;
    if (!field || !p) return;
    const f = field.getBoundingClientRect(), h = p.offsetHeight, w = fullWidth ? f.width : p.offsetWidth;
    const lim = bars(), vw = document.documentElement.clientWidth;
    const below = lim.bottom - f.bottom - 4, above = f.top - 4 - lim.top;
    if (scrollIfNeeded && below < h && above < h) {
      window.scrollBy(0, f.top - lim.top); // neither side fits: bring the field to the top, then place below
      return place(false);
    }
    const left = Math.max(16, Math.min(f.left, vw - 16 - w));
    setStyle(below >= h || below >= above
      ? { top: f.bottom + 4, left, minWidth: f.width, width: fullWidth ? f.width : undefined, maxHeight: Math.max(below, 160) }
      : { bottom: window.innerHeight - f.top + 4, left, minWidth: f.width, width: fullWidth ? f.width : undefined, maxHeight: above });
  }, [fullWidth]);

  useLayoutEffect(() => {
    if (!open) return setStyle({});
    place(true);
    const again = (e: Event) => { if (!panel.current?.contains(e.target as Node)) place(false); };
    window.addEventListener("scroll", again, true);
    window.addEventListener("resize", again);
    return () => { window.removeEventListener("scroll", again, true); window.removeEventListener("resize", again); };
  }, [open, place]);

  return { root, panel, style };
}
