"use client";
// The "Verify my email" button in the sign-up email lands here. Opening the page verifies nothing: mail
// scanners follow links, so the Buddy confirms with one tap (POST). Success signs them in; the app routes on.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { say } from "../form";
import s from "../auth.module.css";

export default function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(token ? "" : "This link is not complete. Open it again from the email, or send a new code.");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFail("");
    try {
      await api("vendor/auth/verify-email-link", { method: "POST", body: { token } });
      try { sessionStorage.removeItem("ab_pro_code_until"); } catch {}
      window.location.assign("/"); // full load: the new session cookie reaches the middleware
    } catch (err) {
      setFail(say(err));
      setBusy(false);
    }
  }

  return (
    <>
      <title>Confirm your email · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1>Confirm your email</h1>
        <p className="sub">One tap confirms this email for your Any-Buddy Pro account.</p>
      </div>
      <form method="post" className={s.form} onSubmit={onSubmit} noValidate>
        {fail ? (
          <p className={s.alert} role="alert">{fail}</p>
        ) : (
          <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Confirming" : "Confirm my email"}</button>
        )}
      </form>
      <p className={s.foot}>
        {fail ? <Link href="/login" className={s.link}>Log in to get a new code</Link> : <Link href="/login" className={s.link}>Back to log in</Link>}
      </p>
    </>
  );
}
