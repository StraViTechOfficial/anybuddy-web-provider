"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { TravelMiles, VendorProfile } from "@/lib/types";
import { Actions, errText, type FormProps } from "./Field";
import { savedMiles, Travel, useTravelRange } from "./Travel";
import s from "./forms.module.css";

// v2 Profile › Service area: how far the Buddy travels from home. Customers further away don't see them.
export function ServiceAreaForm({ mode, onDone }: FormProps) {
  const range = useTravelRange();
  const [saved, setSaved] = useState<TravelMiles | null | undefined>(undefined); // null: none stored
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [far, setFar] = useState(""); // the server's distance rule, shown under the slider

  useEffect(() => {
    api<VendorProfile>("vendor/auth/get-profile-details", { query: { type: 1 } })
      .then(({ data: p }) => {
        setSaved(savedMiles(p.travelMiles) ? p.travelMiles : null);
        if (p.lat != null && p.long != null) setCenter({ lat: p.lat, lng: p.long });
      })
      .catch((e) => setError(errText(e)));
  }, []);

  const [picked, setMiles] = useState<TravelMiles | null>(null);
  const miles = picked ?? saved ?? range?.default ?? null; // none stored: the admin's starting value

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!miles) return;
    setBusy(true);
    setError("");
    setFar("");
    try {
      await api("vendor/auth/service-area", { method: "PUT", body: { travelMiles: miles } });
      onDone();
    } catch (x) {
      if (/distance/i.test(errText(x))) setFar(errText(x)); else setError(errText(x));
    } finally {
      setBusy(false);
    }
  }

  if (!miles || !range || saved === undefined) return error ? <p className="err" role="alert">{error}</p> : <div className="skeleton" style={{ height: 280 }} aria-label="Loading service area" />;
  return (
    <form method="post" className={`${s.form} ${s.narrow}`} onSubmit={submit} noValidate>
      <Travel value={miles} onChange={(m) => { setMiles(m); setFar(""); }} center={center} error={far || undefined} range={range} />
      <Actions mode={mode} busy={busy} error={error} />
    </form>
  );
}
