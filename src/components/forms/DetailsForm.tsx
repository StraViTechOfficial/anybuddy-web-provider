"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MapPin, NavigationArrow, Plus } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { MAPS_KEY, reverse, type Address, type LatLng } from "@/lib/google";
import type { TravelMiles, VendorProfile } from "@/lib/types";
import { Actions, Field, Req, RequiredNote, SelectField, errText, hasErrors, type Errors, type FormProps } from "./Field";
import { AddressSearch } from "./AddressSearch";
import { savedMiles, Travel, useTravelRange } from "./Travel";
import s from "./forms.module.css";

type State = { name: string; isoCode: string };
const EMPTY = { firstName: "", middleName: "", lastName: "", nickname: "", street: "", city: "", state: "", zip: "" };
const UNIT = /\b(apt|apartment|suite|ste|unit|floor|fl|room|rm)\b|#/i; // the building is enough to find the point
const keyOf = (a: { street: string; city: string; state: string; zip: string }) => [a.street, a.city, a.state, a.zip].join("|");
const streetError = (v: string) => v.trim().length < 2 ? "Enter your street address."
  : UNIT.test(v) ? "Leave out the apartment or unit number. Only the building's street address is needed."
  : !/^\d+[a-z-]*\s+\S{2,}/i.test(v.trim()) ? "Start with the house number, then the street name. For example: 1 Beacon St."
  : undefined;
const zipError = (v: string) => (!/^\d{5}$/.test(v) ? "Enter a 5-digit ZIP code." : undefined);

// "Your name and address" in Get verified, opened from Home. It asks for the legal name once (first, optional middle,
// last), the home address (searched with suggestions, found with "Use my location", or typed) and how far the Buddy
// travels. The 18+ and Terms box is now on the log-in screen. Outside the operating area the server says so, and the
// Buddy can join the waitlist, which ends sign-up there. Without the Maps key the fields are typed and checked with
// the address lookup (/onboarding/geocode).
// The "About you" layout is flat, with two labelled sections (You, Where you work) and no boxes. A live line shows how
// customers see the name, and Continue sits right after the slider.
export function DetailsForm({ mode, onDone }: FormProps) {
  const [v, setV] = useState(EMPTY);
  const [point, setPoint] = useState<(LatLng & { for: string }) | null>(null); // only for the address it was found for
  const range = useTravelRange();
  const [saved, setSaved] = useState<TravelMiles | null>(null); // when none is stored, use the admin's starting value
  const [picked, setMiles] = useState<TravelMiles | null>(null);
  const miles = picked ?? saved ?? range?.default ?? null;
  const [gaps, setGaps] = useState<Address["missing"]>([]); // what the picked address lacks; the Buddy adds it
  const [typing, setTyping] = useState(!MAPS_KEY);
  const [states, setStates] = useState<State[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "locate" | "join">("");
  const [error, setError] = useState("");
  const [addrNote, setAddrNote] = useState("");
  const [where, setWhere] = useState<{ field: string; message: string; for: string } | null>(null);
  const [outside, setOutside] = useState("");
  const [far, setFar] = useState(""); // the server's distance rule, shown under the slider
  const [joined, setJoined] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [middle, setMiddle] = useState(false); // "+ Middle name" opens it, and it starts open when a middle name is saved

  useEffect(() => {
    api<State[]>("list-location", { query: { country: "United States" } })
      .then((r) => setStates(r.data.filter((x) => /^[A-Z]{2}$/.test(x.isoCode)))).catch(() => {});
    api<VendorProfile>("vendor/auth/get-profile-details", { query: { type: 1 } })
      .then(({ data: p }) => { // for a Buddy who started on an old app, what they saved before
        const a = { firstName: p.firstName ?? "", middleName: p.middleName ?? "", lastName: p.lastName ?? "", nickname: p.nickname ?? "", street: p.address?.street ?? "", city: p.address?.city ?? "", state: p.address?.state ?? "", zip: p.postalCode ?? "" };
        setV(a);
        if (a.middleName) setMiddle(true);
        if (p.lat != null && p.long != null && a.street) setPoint({ lat: p.lat, lng: p.long, for: keyOf(a) });
        if (savedMiles(p.travelMiles)) setSaved(p.travelMiles);
        if (a.street && !(p.lat != null)) setTyping(true);
      })
      .then(() => setLoaded(true))
      .catch((e) => setError(errText(e)));
  }, []);
  useEffect(() => { // older records hold the state's name, but the select uses its code
    const hit = states.find((x) => x.name.toLowerCase() === v.state.toLowerCase());
    if (hit) setV((o) => ({ ...o, state: hit.isoCode }));
  }, [states, v.state]);

  const addrKey = keyOf(v);
  // A nickname shows alone; otherwise first name and last initial.
  const shown = `${v.nickname.trim() || `${v.firstName.trim() || "First"} ${v.lastName.trim()[0]?.toUpperCase() ?? "L"}.`}${v.city.trim() ? ` · ${v.city.trim()}` : ""}`;
  const at = point?.for === addrKey ? point : null;
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value }));
  // A picked address always shows its card. A missing house number or ZIP is asked for under it, never cleared silently.
  const place = (a: Address) => {
    const next = { street: a.street, city: a.city, state: a.state, zip: a.zip };
    setV((o) => ({ ...o, ...next }));
    setPoint({ lat: a.lat, lng: a.lng, for: keyOf(next) });
    setGaps(a.missing);
    setAddrNote("");
  };
  const fix = (k: "street" | "zip") => (e: { target: { value: string } }) => { // keeps the picked point with the address
    const n = { ...v, [k]: e.target.value };
    if (at) setPoint({ ...at, for: keyOf(n) });
    setV(n);
  };
  const fail = useCallback((message: string) => { setTyping(true); setAddrNote(message); }, []);

  const check = (): Errors => ({
    firstName: v.firstName.trim().length < 2 ? "Enter your legal first name." : undefined,
    lastName: v.lastName.trim().length < 2 ? "Enter your legal last name." : undefined,
    ...(!typing ? {
      address: !at ? "Search for your address and pick it from the list." : undefined,
      ...(at && gaps.includes("street") && { street: streetError(v.street) }),
      ...(at && gaps.includes("zip") && { zip: zipError(v.zip) }),
    } : {
      street: streetError(v.street),
      city: v.city.trim().length < 2 ? "Enter your city." : undefined,
      state: !v.state ? "Choose your state." : undefined,
      zip: zipError(v.zip),
    }),
  });
  const errs: Errors = tried ? { ...check(), ...(where?.for === addrKey && { [where.field]: where.message }) } : {};

  async function locate() {
    setBusy("locate");
    setAddrNote("");
    try {
      const pos = await new Promise<GeolocationPosition>((ok, no) =>
        navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
      const a = await reverse({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (a) place(a);
      else setAddrNote("No street address was found at your location. Search for your address instead.");
    } catch (e) {
      setAddrNote((e as GeolocationPositionError)?.code === 1 ? "Location is off for this site. Search for your address instead." : "Your location didn't load. Search for your address instead.");
    }
    setBusy("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError("");
    setFar("");
    if (hasErrors(check())) return;
    if (!miles) return; // the travel range is still loading
    setBusy("save");
    try {
      let p: LatLng | null = at;
      if (!p) { // for a typed address, the lookup finds the point or names the field that is wrong
        const geo = await fetch("/onboarding/geocode?" + new URLSearchParams({ street: v.street, city: v.city, state: v.state, zip: v.zip }));
        const r = await geo.json().catch(() => ({}));
        if (!geo.ok) {
          if (!r.field) return setError(r.message ?? "We can't check addresses right now. Try again in a moment.");
          setWhere({ field: r.field, message: r.message, for: addrKey });
          return document.getElementById(r.field)?.focus();
        }
        p = { lat: r.latitude, lng: r.longitude };
      }
      await api("vendor/auth/details", {
        method: "PUT",
        body: {
          firstName: v.firstName.trim(), middleName: v.middleName.trim(), lastName: v.lastName.trim(), nickname: v.nickname.trim(),
          address: { street: v.street.trim(), city: v.city.trim(), state: v.state, country: "United States" }, postalCode: v.zip,
          latitude: p.lat, longitude: p.lng, travelMiles: miles, termsAccepted: true, // ticked at log in; the server keeps the first time it was ticked
        },
      });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && (e.data as { outsideArea?: boolean } | null)?.outsideArea) setOutside(e.message);
      else if (/distance/i.test(errText(e))) setFar(errText(e)); // "Choose a distance from 1 to 100 miles."
      else setError(errText(e));
    } finally {
      setBusy("");
    }
  }

  async function join() {
    setBusy("join");
    setError("");
    try {
      setJoined((await api("vendor/auth/waitlist", { method: "POST", body: { state: v.state, postalCode: v.zip } })).message);
    } catch (e) {
      setError(errText(e));
    }
    setBusy("");
  }

  if (outside) {
    return (
      <div className={`${s.form} ${s.narrow}`}>
        <p className={`box ${s.saved}`} role="status"><b>{outside}</b></p>
        {joined ? <p className={s.ok} role="status">{joined}</p> : (
          <div><button type="button" className="btn p lg" onClick={join} disabled={busy === "join"} aria-busy={busy === "join"}>Join the waitlist</button></div>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        <div><button type="button" className="btn lg" onClick={() => { setOutside(""); setJoined(""); }}>Change address</button></div>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={`${s.form} ${s.narrow}`} disabled={!loaded}>
        <RequiredNote />
        <h2 className={s.section}>You</h2>
        <fieldset className={s.stack} aria-describedby="name-hint">
          <legend className="sr">Legal name</legend>
          <div className={s.pair}>
            <Field id="firstName" label="First name" required error={errs.firstName}><input autoComplete="given-name" value={v.firstName} onChange={set("firstName")} maxLength={100} /></Field>
            <Field id="lastName" label="Last name" required error={errs.lastName}><input autoComplete="family-name" value={v.lastName} onChange={set("lastName")} maxLength={100} /></Field>
          </div>
          <div className={s.labelLine}>
            <small id="name-hint" className="hint">As on your ID</small>
            {!middle && <button type="button" className={`${s.link} ${s.tap}`} onClick={() => setMiddle(true)}><Plus size={14} aria-hidden /> Middle name</button>}
          </div>
          {middle && (
            <div className={s.pair}>
              <Field id="middleName" label="Middle name (optional)"><input autoComplete="additional-name" value={v.middleName} onChange={set("middleName")} maxLength={50} autoFocus={!v.middleName} /></Field>
              <button type="button" className={`${s.link} ${s.tap} ${s.remove}`} onClick={() => { setMiddle(false); setV((o) => ({ ...o, middleName: "" })); }}>Remove<span className="sr"> middle name</span></button>
            </div>
          )}
        </fieldset>
        <Field id="nickname" label="Nickname (optional)" hint={<>Shown to customers instead of your first name.<br /><span aria-live="polite">Customers see you as <b>{shown}</b></span></>}>
          <input autoComplete="nickname" value={v.nickname} onChange={set("nickname")} maxLength={30} placeholder="What customers call you" />
        </Field>
        <div className="field">
          <div className={s.labelLine}>
            {typing ? <h2 className={s.section}>Home address</h2> : <label className={s.section} htmlFor="address">Home address<Req /></label>}
            {MAPS_KEY && typing && (
              <button type="button" className={`${s.link} ${s.tap}`} onClick={locate} disabled={busy === "locate"} aria-busy={busy === "locate"}>
                <NavigationArrow size={16} aria-hidden /> {busy === "locate" ? "Finding you" : "Use my location"}
              </button>
            )}
          </div>
          {!typing && (at ? (
            <div className={s.picked}>
              <MapPin size={20} aria-hidden />
              <span className={s.pickedText}><b>{v.street}</b><span className="hint">{v.city}, {v.state} {v.zip}</span></span>
              <button type="button" className="btn" onClick={() => { setPoint(null); setGaps([]); }}>Change</button>
            </div>
          ) : (
            <div className={s.locWrap}>
              <AddressSearch onPick={place} onFail={fail} error={errs.address || addrNote || undefined} />
              {MAPS_KEY && (
                <button type="button" className={s.loc} onClick={locate} disabled={busy === "locate"} aria-busy={busy === "locate"} aria-label="Use my location">
                  {busy === "locate" ? <span className="spin" aria-hidden /> : <NavigationArrow size={20} aria-hidden />}
                </button>
              )}
            </div>
          ))}
          {typing && addrNote && <small className="err" role="alert">{addrNote}</small>}
          <small id="address-hint" className="hint">Customers only see your city.</small>
          {!typing && at && gaps.length > 0 && (
            <div className={s.stack}>
              <p className={`${s.note} t-wait`} role="status">
                {gaps.length > 1 ? "This address has no house number or ZIP code. Add them below."
                  : gaps[0] === "street" ? "This address has no house number. Add it to the street address below." : "This address has no ZIP code. Add it below."}
              </p>
              <div className="row2">
                {gaps.includes("street") && <Field id="street" label="Street address" required error={errs.street}><input autoComplete="address-line1" value={v.street} onChange={fix("street")} maxLength={100} /></Field>}
                {gaps.includes("zip") && <Field id="zip" label="ZIP code" required error={errs.zip}><input autoComplete="postal-code" inputMode="numeric" value={v.zip} onChange={fix("zip")} maxLength={5} /></Field>}
              </div>
            </div>
          )}
          {!typing && <button type="button" className={`${s.link} ${s.tap}`} onClick={() => setTyping(true)}>Enter the address yourself</button>}
        </div>
        {typing && (
          <div className={s.addrRow}>
            <Field id="street" label="Street address" required error={errs.street}><input autoComplete="address-line1" value={v.street} onChange={set("street")} maxLength={100} /></Field>
            <Field id="city" label="City" required error={errs.city}><input autoComplete="address-level2" value={v.city} onChange={set("city")} maxLength={50} /></Field>
            <SelectField id="state" label="State" required error={errs.state} value={v.state} onChange={(state) => setV((o) => ({ ...o, state }))}
              options={states.map((x) => ({ value: x.isoCode, label: x.name }))} />
            <Field id="zip" label="ZIP code" required error={errs.zip}><input autoComplete="postal-code" inputMode="numeric" value={v.zip} onChange={set("zip")} maxLength={5} /></Field>
          </div>
        )}
        {range && miles ? <Travel value={miles} onChange={(m) => { setMiles(m); setFar(""); }} center={at} error={far || undefined} range={range} />
          : <div className="skeleton" style={{ height: 260 }} aria-label="Loading service area" />}
        <Actions mode={mode} busy={busy === "save"} error={error} />
      </fieldset>
    </form>
  );
}
