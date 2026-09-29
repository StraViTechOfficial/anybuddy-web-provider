"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { newPasswordError, Password, say, useForm } from "../form";
import { Req, RequiredNote } from "@/components/forms/Field";
import s from "../auth.module.css";

// Reached signed in, straight from the reset code. Lives in (auth), not (app): the app layout would send a Buddy
// with unfinished onboarding to /onboarding before they could set the password. Middleware still needs the session.
export default function Reset() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const f = useForm({ newPassword: "", confirmPassword: "" }, (v) => ({
    newPassword: newPasswordError(v.newPassword),
    confirmPassword: !v.confirmPassword ? "Enter the password again." : v.confirmPassword === v.newPassword ? undefined : "The passwords don't match.",
  }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFail("");
    if (!f.submit()) return;
    setBusy(true);
    try {
      await api("vendor/auth/set-new-password", { method: "PUT", body: f.values });
    } catch (err) {
      setFail(say(err));
      setBusy(false);
      return;
    }
    // The backend has ended every session; this clears our cookies too (the proxy drops them either way).
    await api("vendor/auth/logout", { method: "POST" }).catch(() => {});
    toast("Password updated. Log in with your new password.");
    router.replace("/login");
  }

  return (
    <>
      <title>Choose a new password · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1>Choose a new password</h1>
        <p className="sub">Use a password you have not used on Any-Buddy before.</p>
      </div>
      <form method="post" className={s.form} onSubmit={onSubmit} noValidate>
        <RequiredNote />
        <label className="field">
          <span>New password<Req /></span>
          <Password {...f.field("newPassword")} autoComplete="new-password" required autoFocus aria-describedby={f.field("newPassword")["aria-describedby"] ?? "newPassword-hint"} />
          {f.error("newPassword") ?? <p id="newPassword-hint" className="hint">At least 8 characters</p>}
        </label>
        <label className="field">
          <span>Confirm new password<Req /></span>
          <Password {...f.field("confirmPassword")} autoComplete="new-password" required />
          {f.error("confirmPassword")}
        </label>
        {fail && <p className={s.alert} role="alert">{fail}</p>}
        <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Saving password" : "Save password"}</button>
      </form>
    </>
  );
}
