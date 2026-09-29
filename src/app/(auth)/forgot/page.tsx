"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { emailError, say, startCode, useForm } from "../form";
import { Req, RequiredNote } from "@/components/forms/Field";
import s from "../auth.module.css";

export default function Forgot() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const f = useForm({ email: "" }, (v) => ({ email: emailError(v.email) }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFail("");
    if (!f.submit()) return;
    setBusy(true);
    try {
      // Same reply for an unknown email (the backend sends nothing then), so the next screen says "if".
      await api("vendor/auth/forget-password", { method: "PUT", body: { email: f.values.email.trim() } });
      startCode();
      router.push("/code?flow=reset");
    } catch (err) {
      setFail(say(err));
      setBusy(false);
    }
  }

  return (
    <>
      <title>Reset your password · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1>Reset your password</h1>
        <p className="sub">Enter the email address on your account and we will send you a 6-digit code.</p>
      </div>
      <form method="post" className={s.form} onSubmit={onSubmit} noValidate>
        <RequiredNote />
        <label className="field">
          <span>Email address<Req /></span>
          <input {...f.field("email")} className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" autoFocus required />
          {f.error("email")}
        </label>
        {fail && <p className={s.alert} role="alert">{fail}</p>}
        <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Sending code" : "Send code"}</button>
      </form>
      <p className={s.foot}>
        <Link href="/login" className={s.link}>Back to log in</Link>
      </p>
    </>
  );
}
