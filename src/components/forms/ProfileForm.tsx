"use client";
import { useEffect, useState, type FormEvent } from "react";
import { UserCircle } from "@phosphor-icons/react";
import { api, upload } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { Actions, Field, errText, hasErrors, rateError, type Errors, type FormProps } from "./Field";
import s from "./forms.module.css";

type State = { name: string; isoCode: string };
const EMPTY = { firstName: "", lastName: "", street: "", city: "", state: "", zip: "", rate: "", about: "", areas: "" };

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
          rate: p.price ? String(Math.round(p.price)) : "", about: p.description ?? "", areas: p.serviceArea ?? "",
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
    rate: rateError(v.rate),
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
          postalCode: v.zip, price: +v.rate, latitude: point.latitude, longitude: point.longitude,
          ...(v.about.trim() && { description: v.about.trim() }),
          ...(v.areas.trim() && { serviceArea: v.areas.trim() }),
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
    <form onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!loaded}>
      <div className={s.cols}>
        <div className={s.stack}>
          <div className={s.photo}>
            {img ? <img src={img} alt="" width={64} height={64} /> : <UserCircle size={64} weight="light" aria-hidden />}
            <div>
              <label className="btn" aria-busy={photo.busy}>
                {photo.busy ? "Uploading" : img ? "Change photo" : "Add photo"}
                <input className="sr" type="file" accept="image/jpeg,image/png,image/webp" disabled={photo.busy}
                  onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </label>
              {photo.error ? <p className="err">{photo.error}</p> : <p className="hint">Optional. A clear photo of your face helps customers.</p>}
            </div>
          </div>
          <div className="row2">
            <Field id="firstName" label="First name" error={errs.firstName}><input autoComplete="given-name" value={v.firstName} onChange={set("firstName")} maxLength={50} /></Field>
            <Field id="lastName" label="Last name" error={errs.lastName}><input autoComplete="family-name" value={v.lastName} onChange={set("lastName")} maxLength={50} /></Field>
          </div>
          <Field id="about" label="About you" error={errs.about} hint={mode === "edit" ? "Leave empty to keep what you wrote before." : "At least 20 characters."}>
            <textarea className={`input ${s.about}`} value={v.about} onChange={set("about")} maxLength={1000}
              placeholder="Your experience, the jobs you do best, and what customers can expect." />
          </Field>
        </div>
        <div className={s.stack}>
          <h2>Home base</h2>
          <Field id="street" label="Street address" error={errs.street}><input autoComplete="street-address" value={v.street} onChange={set("street")} maxLength={100} /></Field>
          <div className={s.row3}>
            <Field id="city" label="City" error={errs.city}><input autoComplete="address-level2" value={v.city} onChange={set("city")} maxLength={50} /></Field>
            <Field id="state" label="State" error={errs.state}>
              <select autoComplete="address-level1" value={v.state} onChange={set("state")} className="input">
                <option value="">Choose</option>
                {states.map((x) => <option key={x.isoCode} value={x.isoCode}>{x.name}</option>)}
              </select>
            </Field>
            <Field id="zip" label="ZIP code" error={errs.zip}><input autoComplete="postal-code" inputMode="numeric" value={v.zip} onChange={set("zip")} maxLength={5} /></Field>
          </div>
          <div className="row2">
            <Field id="rate" label="Hourly rate (USD)" error={errs.rate} hint="Used for new services.">
              <input inputMode="numeric" value={v.rate} onChange={set("rate")} maxLength={4} placeholder="45" />
            </Field>
            <Field id="areas" label="Areas you serve" hint="Optional.">
              <input value={v.areas} onChange={set("areas")} maxLength={100} placeholder="Boston, Cambridge" />
            </Field>
          </div>
        </div>
      </div>
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} />
      </fieldset>
    </form>
  );
}
