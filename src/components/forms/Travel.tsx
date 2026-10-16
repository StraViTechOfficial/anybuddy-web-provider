"use client";
// v2: "Service area", how far the Buddy travels, as a slider whose range, step and starting value
// come from GET /api/config (admin setting), with a circle around home once an address is picked: Google map with the
// key, else a drawn circle to scale.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "@/lib/api";
import { library, MAPS_KEY, type GCircle, type GMap, type LatLng, type Maps } from "@/lib/google";
import type { TravelMiles } from "@/lib/types";
import s from "./forms.module.css";

export type TravelRange = { min: number; max: number; step: number; default: number };
const FALLBACK: TravelRange = { min: 1, max: 100, step: 1, default: 10 }; // only if /config fails; mirrors the server's own fallback
const METERS_PER_MILE = 1609.344;
let asked: Promise<TravelRange> | null = null;
/** The admin's travel range (once per page load); the fallback when the server is older or unreachable. */
export function useTravelRange() {
  const [range, setRange] = useState<TravelRange | null>(null);
  useEffect(() => {
    asked ??= api<{ travelMiles?: Partial<TravelRange> }>("config").then(({ data }) => {
      const t = data?.travelMiles;
      const ok = t && [t.min, t.max, t.step, t.default].every((n) => typeof n === "number" && n > 0) && t.min! < t.max!;
      return ok ? (t as TravelRange) : FALLBACK;
    }, () => FALLBACK);
    asked.then(setRange);
  }, []);
  return range;
}
/** A saved value worth showing: any whole number of miles (one outside a later-narrowed range is kept, never changed). */
export const savedMiles = (n: unknown): n is TravelMiles => typeof n === "number" && n > 0;

// Section label "Travel distance", the map above the slider (so Continue/Save follows it), "Up to N miles".
export function Travel({ value, onChange, center, error, range: r }: { value: TravelMiles; onChange: (m: TravelMiles) => void; center: LatLng | null; error?: string; range: TravelRange }) {
  const map = center && (MAPS_KEY ? <MapCircle miles={value} center={center} /> : <DrawnCircle miles={value} max={r.max} />);
  const pct = Math.min(100, Math.max(0, ((value - r.min) / (r.max - r.min)) * 100));
  return (
    <div className={`field ${s.rate}`}>
      <label className={s.section} htmlFor="miles">Travel distance</label>
      {/* The map and circle show only once an address is picked; no default map before that. */}
      {map}
      <output htmlFor="miles" className={s.milesNow}>Up to {mi(value)}</output>
      <input id="miles" type="range" className={s.range} min={r.min} max={r.max} step={r.step} value={value}
        style={{ "--f": pct / 100 } as CSSProperties} aria-valuetext={mi(value)}
        aria-invalid={error ? true : undefined} aria-describedby={error ? "miles-err" : "miles-hint"}
        onChange={(e) => onChange(Number(e.target.value))} />
      <div className={s.scale} aria-hidden><span>{r.min} mi</span><span>{r.max} mi</span></div>
      {error ? <small id="miles-err" className="err" role="alert">{error}</small>
        : <small id="miles-hint" className="hint" aria-live="polite">You&apos;ll get jobs within {mi(value)} of your home.</small>}
    </div>
  );
}

const mi = (n: number) => (n === 1 ? "1 mile" : `${n} miles`);
const label = (miles: number) => `Travel area: up to ${miles} miles from home`;

function MapCircle({ miles, center }: { miles: number; center: LatLng }) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ map: GMap; circle: GCircle } | null>(null);
  const { lat, lng } = center;
  useEffect(() => {
    let gone = false;
    library<Maps>("maps").then((m) => {
      if (gone || !box.current) return;
      const at = { lat, lng };
      const map = new m.Map(box.current, { center: at, zoom: 10, disableDefaultUI: true, gestureHandling: "cooperative", keyboardShortcuts: false, colorScheme: "FOLLOW_SYSTEM" });
      setLive({ map, circle: new m.Circle({ map, center: at, radius: 0, strokeColor: "#17181c", strokeWeight: 2, fillColor: "#17181c", fillOpacity: 0.12, clickable: false }) });
    }, () => {}); // no map: the label still says the distance
    return () => { gone = true; setLive(null); };
  }, [lat, lng]);
  useEffect(() => { // each chip resizes the circle and fits the map to it
    if (!live) return;
    live.circle.setRadius(miles * METERS_PER_MILE);
    live.map.fitBounds(live.circle.getBounds(), 8);
  }, [live, miles]);
  return <div ref={box} className={s.map} role="img" aria-label={label(miles)} />;
}

/** To scale against the highest distance; the chosen one filled, each quarter as a faint ring. */
function DrawnCircle({ miles, max }: { miles: number; max: number }) {
  const r = (m: number) => Math.max(6, (Math.min(m, max) / max) * 92);
  return (
    <svg className={s.map} viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet" role="img" aria-label={label(miles)}>
      {[1, 2, 3, 4].map((q) => <circle key={q} r={r((max * q) / 4)} className={s.ring} />)}
      <circle r={r(miles)} className={s.area} />
      <circle r={4} className={s.home} />
      <text y={-r(miles) - 6} textAnchor="middle" className={s.mi}>{miles} mi</text>
    </svg>
  );
}
