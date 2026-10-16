"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { UserCircle } from "@phosphor-icons/react";
import { api, FILES, fileRule } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { Actions, Field, RequiredNote, SelectField, errText, hasErrors, type Errors, type FormProps } from "./Field";
import { UploadNote, useUploads } from "./Upload";
import s from "./forms.module.css";

type State = { name: string; isoCode: string };
// Unit words in the street line. The lookup needs the building only; the unit doesn't change the distance.
const UNIT = /\b(apt|apartment|appartment|suite|ste|unit|floor|fl|room|rm)\b|#/i;
const EMPTY = { firstName: "", lastName: "", nickname: "", street: "", city: "", state: "", zip: "", about: "" };

// Step 1 and Account › Profile. The address is turned into a map point on save, because services need one.
export function ProfileForm({ mode, onDone, onBack }: FormProps) {
  const { reload } = useVendor();
  const [v, setV] = useState(EMPTY);
  const [logoUrl, setLogoUrl] = useState("");
  const [contact, setContact] = useState({ phone: "", email: "" }); // shown read-only
  const { slots, pick } = useUploads<"photo">("profile", "photo");
  const photo = slots.photo;
  const [states, setStates] = useState<State[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [where, setWhere] = useState<{ field: string; message: string; for: string } | null>(null); // address lookup says which field is wrong
  const [loaded, setLoaded] = useState(false); // inputs stay disabled until the saved values are in

  useEffect(() => {
    api<State[]>("list-location", { query: { country: "United States" } })
      .then((r) => setStates(r.data.filter((x) => /^[A-Z]{2}$/.test(x.isoCode))))
      .catch(() => {});
    api<VendorProfile>("vendor/auth/get-profile-details", { query: { type: 1 } })
      .then(({ data: p }) => {
        setV({
          firstName: p.firstName ?? "", lastName: p.lastName ?? "", nickname: p.nickname ?? "",
          street: p.address?.street ?? "", city: p.address?.city ?? "", state: p.address?.state ?? "", zip: p.postalCode ?? "",
          about: p.description ?? "",
        });
        setLogoUrl(p.logoUrl ?? "");
        setContact({ phone: [p.countryCode, p.phone].filter(Boolean).join(" "), email: p.email ?? "" });
      })
      .then(() => setLoaded(true))
      .catch((e) => setError(errText(e)));
  }, []);

  useEffect(() => { // older records hold the state's name, but the select uses its code
    const hit = states.find((x) => x.name.toLowerCase() === v.state.toLowerCase());
    if (hit) setV((o) => ({ ...o, state: hit.isoCode }));
  }, [states, v.state]);

  const set = (k:keyof typeof EMPTY) => (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value }));

  const check = (): Errors => ({
    firstName: v.firstName.trim().length < 2 ? "Enter your first name." : undefined,
    lastName: v.lastName.trim().length < 2 ? "Enter your last name." : undefined,
    street: v.street.trim().length < 2 ? "Enter your street address."
      : UNIT.test(v.street) ? "Leave out the apartment or suite number. Only the building's street address is needed."
      : !/^\d+[a-z-]*\s+\S{2,}/i.test(v.street.trim()) ? "Start with the building number, then the street name. For example: 1148 Main St."
      : undefined,
    city: v.city.trim().length < 2 ? "Enter your city." : undefined,
    state: !v.state ? "Choose your state." : undefined,
    zip: !/^\d{5}$/.test(v.zip) ? "Enter a 5-digit ZIP code." : undefined,
  });
  const addrKey = [v.street, v.city, v.state, v.zip].join("|");
  const errs: Errors = tried ? { ...check(), ...(where?.for === addrKey && { [where.field]: where.message }) } : {}; // the lookup's note clears once the address changes

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError("");
    if (hasErrors(check())) return;
    setBusy(true);
    try {
      const geo = await fetch("/onboarding/geocode?" + new URLSearchParams({ street: v.street, city: v.city, state: v.state, zip: v.zip }));
      const point = await geo.json().catch(() => ({}));
      if (!geo.ok) {
        if (!point.field) return setError(point.message ?? "We can't check addresses right now. Try again in a moment.");
        setWhere({ field: point.field, message: point.message, for: addrKey });
        document.getElementById(point.field)?.focus();
        return;
      }
      await api("vendor/auth/update-register-profile", {
        method: "POST",
        body: {
          step: 1, firstName: v.firstName.trim(), lastName: v.lastName.trim(), nickname: v.nickname.trim(), logoUrl: photo?.url || logoUrl,
          address: { street: v.street.trim(), city: v.city.trim(), state: v.state, country: "United States" },
          postalCode: v.zip, latitude: point.latitude, longitude: point.longitude,
          ...(v.about.trim() && { description: v.about.trim() }),
        },
      });
      await reload().catch(() => {});
      onDone();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const img = photo?.local || logoUrl;
  return (
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!loaded}>
      <RequiredNote />
      {/* Same sections and labels as sign-up ("You", "Home address"). */}
      <h2 className={s.section}>You</h2>
      {/* Plain rows: every input in a row shares one top line, so hints and errors only add space below and never skew a row. */}
      <div className={s.nameRow}>
        <div className="field">
          <span className={s.label} id="photo-l">Photo (optional)</span>
          <div className={s.photo} aria-labelledby="photo-l" role="group" aria-busy={photo?.busy || undefined}>
            {img ? <img src={img} alt="" width={44} height={44} /> : <UserCircle size={44} weight="light" aria-hidden />}
            <label className="btn">
              {img ? "Change" : "Add photo"}
              <input className="sr" type="file" accept={FILES.photo.accept} disabled={photo?.busy}
                aria-describedby={photo?.error ? "photo-err" : undefined} onChange={(e) => { pick("photo", e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          <UploadNote slot={photo} id="photo-err" idle={<small className="hint">{fileRule("photo")}</small>} onRetry={(f) => pick("photo", f)} />
        </div>
        <Field id="firstName" label="First name" required error={errs.firstName}><input autoComplete="given-name" value={v.firstName} onChange={set("firstName")} maxLength={50} /></Field>
        <Field id="lastName" label="Last name" required error={errs.lastName}><input autoComplete="family-name" value={v.lastName} onChange={set("lastName")} maxLength={50} /></Field>
      </div>
      <div className={s.row3}>
        <Field id="nickname" label="Nickname (optional)" hint="Shown to customers instead of your first name."><input autoComplete="nickname" value={v.nickname} onChange={set("nickname")} maxLength={30} /></Field>
      </div>
      <div className={s.row3}>
        <Field id="phone" label="Phone" hint="Your sign-in number."><input type="tel" value={contact.phone} readOnly /></Field>
        <Field id="email" label="Email" hint={<Link href="/account/email">{contact.email ? "Change email" : "Add email"}</Link>}><input type="email" value={contact.email || "Not added"} readOnly /></Field>
      </div>
      <Field id="about" label="About you (optional)" hint={mode === "edit" ? "Leave empty to keep what you wrote before." : undefined}>
        <textarea className={`input ${s.short}`} value={v.about} onChange={set("about")} maxLength={1000}
          placeholder="Your experience, the jobs you do best, and what customers can expect." />
      </Field>
      <h2 className={s.section}>Home address</h2>
      <div className={s.addrRow}>
        <Field id="street" label="Street address" required error={errs.street}><input autoComplete="street-address" value={v.street} onChange={set("street")} maxLength={100} /></Field>
        <Field id="city" label="City" required error={errs.city}><input autoComplete="address-level2" value={v.city} onChange={set("city")} maxLength={50} /></Field>
        <SelectField id="state" label="State" required error={errs.state} value={v.state} onChange={(state) => setV((o) => ({ ...o, state }))}
          options={states.map((x) => ({ value: x.isoCode, label: x.name }))} />
        <Field id="zip" label="ZIP code" required error={errs.zip}><input autoComplete="postal-code" inputMode="numeric" value={v.zip} onChange={set("zip")} maxLength={5} /></Field>
      </div>
      {/* The contract asks for "Location, Complete Address" at sign-up (SPA register) and lists Buddies within 10 km first,
         then by distance (CMA listing). The owner decided that the address the Buddy works from is the service area: search
         reaches 100 km, nearest first, and there is no separate area field. */}
      <p className="hint">Customers only see your city. <Link href="/account/service-area">Travel distance</Link></p>
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} wait={photo?.busy ? "Wait for the upload to finish." : undefined} />
      </fieldset>
    </form>
  );
}
