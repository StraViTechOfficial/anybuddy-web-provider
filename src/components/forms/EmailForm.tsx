"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useVendor } from "@/components/Vendor";
import { useToast } from "@/components/Toast";
import { CodeInput, sendCode, type Sent } from "@/components/Code";
import { errText, type FormProps } from "./Field";
import s from "./forms.module.css";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// v2 R9 Add email (from the checklist and Account): a code to the address proves it; one email per Buddy (the server
// says when another account has it). Two opt-ins, on for a new email (v3 B5). Also used for account recovery and payout changes.
export function EmailForm({ onDone }: FormProps) {
  const { vendor, reload } = useVendor();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [jobs, setJobs] = useState(false);
  const [offers, setOffers] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [tried, setTried] = useState(false);
  const has = !!vendor?.email;
  // Buddies from before v2 have no setting and keep job emails until they change it. A new email: both on (v3 SPEC B5).
  useEffect(() => { if (vendor) { setJobs(!has || (vendor.jobEmails ?? true)); setOffers(!has || !!vendor.offerEmails); } }, [vendor, has]);

  const bad = !EMAIL.test(email.trim()) ? "Enter a valid email address, like name@example.com." : undefined;
  const send = () => sendCode(() => api("vendor/auth/email/send-code", { method: "POST", body: { email: email.trim() } }));
  async function onSend(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setFail("");
    if (bad) return document.getElementById("email")?.focus();
    setBusy(true);
    try {
      setSent(await send());
    } catch (x) {
      setFail(errText(x)); // e.g. "This email is already linked to another Buddy account."
      document.getElementById("email")?.focus();
    }
    setBusy(false);
  }
  async function verify(code: string) {
    const r = await api("vendor/auth/email/verify", { method: "POST", body: { code, jobEmails: jobs, offerEmails: offers } });
    toast(r.message || "Your email is verified.");
    setSent(null);
    setEditing(false);
    setEmail("");
    await reload().catch(() => {});
  }
  async function pref(k: "jobEmails" | "offerEmails", on: boolean) {
    const [get, put] = k === "jobEmails" ? [jobs, setJobs] : [offers, setOffers];
    put(on);
    if (!has || editing) return; // a new email: the choices go with its code
    try {
      await api("vendor/auth/email-preferences", { method: "PUT", body: { [k]: on } });
      onDone();
    } catch (x) {
      put(get);
      toast(errText(x));
    }
  }

  const msg = fail || (tried ? bad : undefined);
  return (
    <div className={`${s.form} ${s.narrow}`}>
      {has && !editing ? (
        <div className={`box ${s.saved} ${s.idCard}`}>
          <span><b>{vendor!.email}</b><span className="hint">Used to log in when your phone is not at hand, and for payout change codes.</span></span>
          <button type="button" className="btn" onClick={() => setEditing(true)}>Change</button>
        </div>
      ) : (
        <form method="post" className={s.stack} onSubmit={onSend} noValidate>
          <div className="field">
            <label className={s.label} htmlFor="email">Email address</label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email" maxLength={100} placeholder="you@example.com"
              value={email} onChange={(e) => { setEmail(e.target.value); setFail(""); setSent(null); }} readOnly={!!sent}
              aria-invalid={msg ? true : undefined} aria-describedby={msg ? "email-err" : undefined} />
            {msg && <small id="email-err" className="err" role="alert">{msg}</small>}
          </div>
          {!sent && <div><button className="btn p lg" disabled={busy} aria-busy={busy}>{busy ? "Sending code" : "Send code"}</button></div>}
        </form>
      )}
      {sent && <CodeInput label="Code from the email" sent={sent} resend={send} verify={verify} submit="Verify email" />}
      <fieldset className={s.stack}>
        <legend className={s.label}>Emails you get</legend>
        {([["jobEmails", "Job updates by email", jobs], ["offerEmails", "Offers and promotions", offers]] as const).map(([k, label, on]) => (
          <label key={k} className={s.toggle}>
            <input type="checkbox" role="switch" checked={on} onChange={(e) => pref(k, e.target.checked)} />
            <span className={s.sw} aria-hidden />
            <span>{label}</span>
          </label>
        ))}
        <small className="hint">Codes, account and payout emails always go to this address.</small>
      </fieldset>
    </div>
  );
}
