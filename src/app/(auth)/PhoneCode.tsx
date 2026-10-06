"use client";
// v2 R1: the mobile number, then the code on the same screen (v2.1 code-step layout). Phone login (phone-login/*) and the new number after the
// email code (phone/*) share it; the caller says how to send and how to check.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, type Reply } from "@/lib/api";
import { CodeInput, sendCode, type Sent } from "@/components/Code";
import { agreedBefore, say } from "./form";
import s from "./auth.module.css";

export const phoneDigits = (v: string) => {
  const d = v.replace(/\D/g, "");
  return (d.length > 10 && d[0] === "1" ? d.slice(1) : d).slice(0, 10);
};
// (617) 555-0123, built up as the Buddy types.
const pretty = (v: string) => {
  const d = phoneDigits(v);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

type Country = { code: string; name: string; flag: string; dial: string };
type Props = {
  send: (phone: string, dial: string) => Promise<Reply<unknown>>;
  verify: (phone: string, code: string, dial: string) => Promise<void>;
  submit: string;
  extra?: ReactNode; // beside the resend timer, once a code is out
  consent?: boolean; // v3 log in or sign up: the 18+/Terms box, Send code waits for it
};

export function PhoneCode({ send, verify, submit, extra, consent }: Props) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [agreed, setAgreed] = useState(false);
  // The server's phoneCountries (US only on live; US + India on the test server), as in the apps.
  const [countries, setCountries] = useState<Country[]>([{ code: "US", name: "United States", flag: "🇺🇸", dial: "+1" }]);
  const [dial, setDial] = useState("+1");
  useEffect(() => { if (consent && agreedBefore()) setAgreed(true); }, [consent]); // after mount: localStorage is browser-only
  useEffect(() => {
    api<{ phoneCountries?: Country[] }>("config").then((r) => { if (r.data?.phoneCountries?.length) setCountries(r.data.phoneCountries); }).catch(() => {});
  }, []);
  const us = dial === "+1";
  const digits = phoneDigits(phone);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (consent && !agreed) return; // Enter can't skip the Terms tick
    setFail("");
    if (digits.length !== 10) {
      setFail(us ? "Enter a 10-digit US mobile number." : "Enter a 10-digit mobile number.");
      return document.getElementById("phone")?.focus();
    }
    setBusy(true);
    try {
      setSent(await sendCode(() => send(digits, dial)));
    } catch (err) {
      setFail(say(err));
    }
    setBusy(false);
  }
  function change() {
    setSent(null);
    setTimeout(() => document.getElementById("phone")?.focus());
  }

  // v2.1 code step: the number field gives way to "Enter the code", where it went, and "Change number".
  if (sent) {
    return (
      <CodeInput label="Enter the code" sent={sent} submit={submit}
        head={
          <div className={s.sentTo}>
            <p className="sub">We texted it to <span className={s.nowrap}>{dial} {us ? pretty(phone) : digits}</span></p>
            <button type="button" className={s.small} onClick={change}>Change number</button>
          </div>
        }
        resend={() => sendCode(() => send(digits, dial))} verify={(code) => verify(digits, code, dial)}>{extra}</CodeInput>
    );
  }
  return (
    <form method="post" className={s.form} onSubmit={onSend} noValidate>
      <div className="field">
        <label htmlFor="phone" className={s.label}>Mobile number</label>
        <span className={s.phone}>
          {countries.length > 1 ? (
            <select aria-label="Country code" value={dial} onChange={(e) => { setDial(e.target.value); setFail(""); }}>
              {countries.map((c) => <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>)}
            </select>
          ) : <b aria-hidden>+1 US</b>}
          <input id="phone" name="phone" className="input" type="tel" autoComplete="tel-national" inputMode="tel" placeholder={us ? "(617) 555-0123" : "98765 43210"}
            maxLength={14} value={us ? pretty(phone) : digits} onChange={(e) => { setPhone(e.target.value); setFail(""); }}
            aria-invalid={!!fail || undefined} aria-describedby={fail ? "phone-err" : undefined} required />
        </span>
        {fail && <p id="phone-err" className="err" role="alert">{fail}</p>}
      </div>
      {consent && (
        <label className={s.check}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I&apos;m 18 or older and agree to the{" "}
            <a className={s.link} href="https://www.any-buddy.com/terms" target="_blank" rel="noopener noreferrer">Terms</a> and{" "}
            <a className={s.link} href="https://www.any-buddy.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </span>
        </label>
      )}
      <button className="btn p lg block" disabled={busy || digits.length !== 10 || (consent && !agreed)} aria-busy={busy}>{busy ? "Sending code" : "Send code"}</button>
    </form>
  );
}
