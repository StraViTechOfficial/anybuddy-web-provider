"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { CodeInput, sendCode, type Sent } from "@/components/Code";
import { useToast } from "@/components/Toast";
import { emailError, rememberAgreed, say } from "../form";
import { PhoneCode } from "../PhoneCode";
import s from "../auth.module.css";

// "Log in with email", for existing Buddies. We send a code to the account email (an unknown email gets the same
// reply), and the code logs them in. Then the Buddy adds the number they use now (phone/send-code, phone/verify,
// update-phone). They may also keep the old number.
export default function Recover() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [inside, setInside] = useState(false); // once logged in, the phone step shows
  const bad = tried ? emailError(email) : undefined;
  const send = () => sendCode(() => api("vendor/auth/email-login/send-code", { method: "POST", body: { email: email.trim() } }));

  async function onSend(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setFail("");
    if (emailError(email)) return document.getElementById("email")?.focus();
    setBusy(true);
    try {
      setSent(await send());
    } catch (err) {
      setFail(say(err));
    }
    setBusy(false);
  }
  async function verify(code: string) {
    await api("vendor/auth/verify-otp", { method: "POST", body: { loginOtp: code } });
    rememberAgreed();
    setInside(true);
  }
  const done = () => window.location.replace("/"); // Always go to Home, with a full page load (see the note in login about the prefetched "/" redirect).
  async function savePhone(phone: string, code: string) {
    const { data } = await api<{ phoneToken: string }>("vendor/auth/phone/verify", { method: "POST", body: { countryCode: "+1", phone, code } });
    const r = await api("vendor/auth/update-phone", { method: "PUT", body: { phoneToken: data.phoneToken } });
    toast(r.message || "Your phone number is updated.");
    done();
  }

  if (inside) {
    return (
      <>
        <title>Update your mobile number · Any-Buddy Pro</title>
        <div className={s.head}>
          <h1>Update your mobile number</h1>
          <p className="sub">You are logged in. Add the number you use now, and log in with it next time.</p>
        </div>
        <PhoneCode submit="Save number" verify={savePhone}
          send={(phone) => api("vendor/auth/phone/send-code", { method: "POST", body: { countryCode: "+1", phone } })} />
        <p className={s.foot}>
          <button type="button" className={s.textBtn} onClick={done}>Keep my current number</button>
        </p>
      </>
    );
  }

  return (
    <>
      <title>Log in with email · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1>Log in with email</h1>
        <p className="sub">Log in with the email on your Buddy account. We email you a 6-digit code.</p>
      </div>
      <div className={s.form}>
        <form method="post" className={s.form} onSubmit={onSend} noValidate>
          <div className="field">
            <label htmlFor="email" className={s.label}>Email address</label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" maxLength={100}
              value={email} onChange={(e) => { setEmail(e.target.value); setFail(""); }} readOnly={!!sent} aria-readonly={!!sent || undefined}
              aria-invalid={!!(bad || fail) || undefined} aria-describedby={bad || fail ? "email-err" : undefined} autoFocus required />
            {(bad || fail) && <p id="email-err" className="err" role="alert">{bad || fail}</p>}
          </div>
          {!sent && <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Sending code" : "Send code"}</button>}
        </form>
        {sent && (
          <CodeInput label="6-digit code" sent={sent} submit="Log in" verify={verify}
            resend={() => sendCode(() => api("vendor/auth/resend-otp", { method: "PUT" }))}>
            <button type="button" className={s.textBtn} onClick={() => setSent(null)}>Change email</button>
          </CodeInput>
        )}
        {/* Shown for every address (the server never says whether the email has an account), so a Buddy with no email isn't stuck. */}
        {sent && (
          <p className={s.note}>
            Codes go only to an email added in your account. Without one, no code arrives.{" "}
            <a className={s.link} href="mailto:info@any-buddy.com?subject=Change%20my%20phone%20number">Contact support</a> to change your phone number.
          </p>
        )}
      </div>
      <p className={s.foot}>
        <Link href="/login" className={s.link}>Log in with your phone</Link>
      </p>
    </>
  );
}
