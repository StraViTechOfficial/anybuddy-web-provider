"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { emailError, newPasswordError, Password, say, startCode, useForm } from "../form";
import s from "../auth.module.css";

const name = (v: string, which: string) => (/^.{2,50}$/.test(v.trim()) ? undefined : `Enter your ${which} name (2 to 50 characters).`);
const digits = (v: string) => v.replace(/\D/g, "");

export default function Signup() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const f = useForm({ firstName: "", lastName: "", email: "", phone: "", password: "", terms: "" }, (v) => ({
    firstName: name(v.firstName, "first"),
    lastName: name(v.lastName, "last"),
    email: emailError(v.email),
    phone: digits(v.phone).length === 10 ? undefined : "Enter a 10-digit US phone number.",
    password: newPasswordError(v.password),
    terms: v.terms ? undefined : "Tick the box to continue.",
  }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFail("");
    if (!f.submit()) return;
    setBusy(true);
    const v = f.values;
    try {
      const { data } = await api<{ codeValidFor?: number }>("vendor/auth/sign-up", {
        method: "POST",
        body: { firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), phone: digits(v.phone), countryCode: "+1", password: v.password },
      });
      startCode(data?.codeValidFor);
      router.push("/code?flow=verify");
    } catch (err) {
      setFail(say(err));
      setBusy(false);
    }
  }

  return (
    <div className={s.wide}>
      <title>Create your Buddy account · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1>Create your Buddy account</h1>
        <p className="sub">Your profile, services and hours come next.</p>
      </div>
      <form className={s.form} onSubmit={onSubmit} noValidate>
        <div className="row2">
          <label className="field">
            <span>First name</span>
            <input {...f.field("firstName")} className="input" autoComplete="given-name" maxLength={50} />
            {f.error("firstName")}
          </label>
          <label className="field">
            <span>Last name</span>
            <input {...f.field("lastName")} className="input" autoComplete="family-name" maxLength={50} />
            {f.error("lastName")}
          </label>
        </div>
        <div className="row2">
          <label className="field">
            <span>Email address</span>
            <input {...f.field("email")} className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" />
            {f.error("email")}
          </label>
          <label className="field">
            <span>Phone number</span>
            <span className={s.phone}>
              <b aria-hidden>+1</b>
              <input {...f.field("phone")} className="input" type="tel" autoComplete="tel-national" inputMode="tel" maxLength={14} />
            </span>
            {f.error("phone")}
          </label>
        </div>
        <label className="field">
          <span>Password</span>
          <Password {...f.field("password")} autoComplete="new-password" aria-describedby={f.field("password")["aria-describedby"] ?? "password-hint"} />
          {f.error("password") ?? <p id="password-hint" className="hint">At least 8 characters</p>}
        </label>
        <div>
          <label className={s.check}>
            <input
              type="checkbox"
              id="terms"
              checked={!!f.values.terms}
              onChange={(e) => { f.set("terms", e.target.checked ? "1" : ""); f.reveal("terms"); }}
              aria-invalid={f.field("terms")["aria-invalid"]}
              aria-describedby={f.field("terms")["aria-describedby"]}
            />
            <span>
              I&apos;m 18 or older and agree to the{" "}
              <a href="https://www.any-buddy.com/terms" target="_blank" rel="noopener noreferrer" className={s.link}>Terms of Use</a> and{" "}
              <a href="https://www.any-buddy.com/privacy-policy" target="_blank" rel="noopener noreferrer" className={s.link}>Privacy Policy</a>
            </span>
          </label>
          {f.error("terms")}
        </div>
        {fail && <p className={s.alert} role="alert">{fail}</p>}
        <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Creating account" : "Create account"}</button>
      </form>
      <p className={s.foot}>
        Already a Buddy. <Link href="/login" className={s.link}>Log in</Link>
      </p>
    </div>
  );
}
