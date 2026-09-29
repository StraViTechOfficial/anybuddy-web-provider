"use client";
import { useEffect, useState, type FormEvent } from "react";
import { UserCircle } from "@phosphor-icons/react";
import { api, upload } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { Actions, Field, RequiredNote, SelectField, errText, hasErrors, type Errors, type FormProps } from "./Field";
import s from "./forms.module.css";

type State = { name: string; isoCode: string };
const EMPTY = { firstName: "", lastName: "", street: "", city: "", state: "", zip: "", about: "" };

// Step 1 and Account › Profile. The address is turned into a map point on save (services need one).
export function ProfileForm({ mode, onDone, onBack }: FormProps) {
  const { reload } = useVendor();
  const [v, setV] = useState(EMPTY);
  const [logoUrl, setLogoUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [photo, setPhoto] = useState<{ busy?: boolean; error?: string }>({});
  const [states, setStates] = useState<State[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false); // inputs stay disabled until the saved values are in

  useEffect(() => {
    api<State[]>("list-location", { query: { country: "United States" } })
      .then((r) => setStates(r.data.filter((x) => /^[A-Z]{2}$/.test(x.isoCode))))
      .catch(() => {});
    api<VendorProfile>("vendor/auth/get-profile-details", { query: { type: 1 } })
      .then(({ data: p }) => {
        setV({
          firstName: p.firstName ?? "", lastName: p.lastName ?? "",
          street: p.address?.street ?? "", city: p.address?.city ?? "", state: p.address?.state ?? "", zip: p.postalCode ?? "",
          about: p.description ?? "",
        });
        setLogoUrl(p.logoUrl ?? "");
      })
      .then(() => setLoaded(true))
      .catch((e) => setError(errText(e)));
  }, []);

  useEffect(() => { // older records hold the state's name, the select holds its code
    const hit = states.find((x) => x.name.toLowerCase() === v.state.toLowerCase());
    if (hit) setV((o) => ({ ...o, state: hit.isoCode }));
  }, [states, v.state]);

  const set = (k:keyof typeof EMPTY) => (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value }));
  const aboutRequired = mode === "onboarding" || v.about.trim() !== ""; // edit: the server doesn't send "about" back yet

  const check = (): Errors => ({
    firstName: v.firstName.trim().length < 2 ? "Enter your first name." : undefined,
    lastName: v.lastName.trim().length < 2 ? "Enter your last name." : undefined,
    about: aboutRequired && v.about.trim().length < 20 ? "Write at least 20 characters about your work." : undefined,
    street: v.street.trim().length < 2 ? "Enter your street address." : undefined,
    city: v.city.trim().length < 2 ? "Enter your city." : undefined,
    state: !v.state ? "Choose your state." : undefined,
    zip: !/^\d{5}$/.test(v.zip) ? "Enter a 5-digit ZIP code." : undefined,
  });
  const errs: Errors = tried ? check() : {};

  async function pickPhoto(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setPhoto({ error: "Choose a photo under 10 MB." });
    setPhoto({ busy: true });
    try {
      setLogoUrl(await upload(file, "profile"));
      setPreview(URL.createObjectURL(file));
      setPhoto({});
    } catch (e) {
      setPhoto({ error: errText(e) });
    }
  }

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
        setError(point.message ?? "We couldn't find that address. Check the street and ZIP.");
        document.getElementById("street")?.focus();
        return;
      }
      await api("vendor/auth/update-register-profile", {
        method: "POST",
        body: {
          step: 1, firstName: v.firstName.trim(), lastName: v.lastName.trim(), logoUrl,
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

  const img = preview || logoUrl;
  return (
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!loaded}>
      <RequiredNote />
      {/* Plain rows: every input in a row shares one top line, so hints and errors only add space below and never skew a row. */}
      <div className={s.nameRow}>
        <div className="field">
          <span className={s.label} id="photo-l">Photo (optional)</span>
          <div className={s.photo} aria-labelledby="photo-l" role="group">
            {img ? <img src={img} alt="" width={44} height={44} /> : <UserCircle size={44} weight="light" aria-hidden />}
            <label className="btn" aria-busy={photo.busy}>
              {photo.busy ? "Uploading" : img ? "Change" : "Add photo"}
              <input className="sr" type="file" accept="image/jpeg,image/png,image/webp" disabled={photo.busy}
                onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>
          </div>
          {photo.error && <small className="err">{photo.error}</small>}
        </div>
        <Field id="firstName" label="First name" required error={errs.firstName}><input autoComplete="given-name" value={v.firstName} onChange={set("firstName")} maxLength={50} /></Field>
        <Field id="lastName" label="Last name" required error={errs.lastName}><input autoComplete="family-name" value={v.lastName} onChange={set("lastName")} maxLength={50} /></Field>
      </div>
      <Field id="about" label="About you" required={mode === "onboarding"} error={errs.about} hint={mode === "edit" ? "Leave empty to keep what you wrote before." : "At least 20 characters."}>
        <textarea className={`input ${s.short}`} value={v.about} onChange={set("about")} maxLength={1000}
          placeholder="Your experience, the jobs you do best, and what customers can expect." />
      </Field>
      <div className={s.addrRow}>
        <Field id="street" label="Street address" required error={errs.street}><input autoComplete="street-address" value={v.street} onChange={set("street")} maxLength={100} /></Field>
        <Field id="city" label="City" required error={errs.city}><input autoComplete="address-level2" value={v.city} onChange={set("city")} maxLength={50} /></Field>
        <SelectField id="state" label="State" required error={errs.state} value={v.state} onChange={(state) => setV((o) => ({ ...o, state }))}
          options={states.map((x) => ({ value: x.isoCode, label: x.name }))} />
        <Field id="zip" label="ZIP code" required error={errs.zip}><input autoComplete="postal-code" inputMode="numeric" value={v.zip} onChange={set("zip")} maxLength={5} /></Field>
      </div>
      {/* Contract (SPA register: "Location, Complete Address"; CMA listing: within 10 km first, then by distance).
          The location is the service area: search reaches 100 km, nearest first. No separate area field. */}
      <p className="hint">Your location. Customers find you by distance from this address, the closest first. They see your city, never your street address.</p>
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} />
      </fieldset>
    </form>
  );
}
