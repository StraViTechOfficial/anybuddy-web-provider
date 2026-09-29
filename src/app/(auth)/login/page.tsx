"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { emailError, landing, Password, safeNext, say, startCode, useForm } from "../form";
import { Req, RequiredNote } from "@/components/forms/Field";
import s from "../auth.module.css";

export default function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const f = useForm({ email: "", password: "" }, (v) => ({
    email: emailError(v.email),
    password: v.password ? undefined : "Enter your password.",
  }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFail("");
    if (!f.submit()) return;
    setBusy(true);
    try {
      const { data } = await api<{ step?: number }>("vendor/auth/login", { method: "POST", body: { email: f.values.email.trim(), password: f.values.password } });
      router.replace(landing(data?.step, safeNext(next)));
    } catch (err) {
      const d = err instanceof ApiError ? (err.data as { needsVerification?: boolean; codeValidFor?: number } | null) : null;
      if (d?.needsVerification) {
        startCode(d.codeValidFor);
        router.push("/code?flow=verify");
        return;
      }
      setFail(say(err));
      setBusy(false);
    }
  }

  return (
    <>
      <title>Log in · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1>Log in</h1>
        <p className="sub">Welcome back to Any-Buddy Pro.</p>
      </div>
      <form method="post" className={s.form} onSubmit={onSubmit} noValidate>
        <RequiredNote />
        <label className="field">
          <span>Email address<Req /></span>
          <input {...f.field("email")} className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required />
          {f.error("email")}
        </label>
        <div className="field">
          <div className={s.labelRow}>
            <label htmlFor="password"><span>Password<Req /></span></label>
            <Link href="/forgot" className={s.link}>Forgot password</Link>
          </div>
          <Password {...f.field("password")} autoComplete="current-password" required />
          {f.error("password")}
        </div>
        {fail && <p className={s.alert} role="alert">{fail}</p>}
        <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Logging in" : "Log in"}</button>
      </form>
      <p className={s.foot}>
        New to Any-Buddy Pro. <Link href="/signup" className={s.link}>Create your Buddy account</Link>
      </p>
    </>
  );
}
