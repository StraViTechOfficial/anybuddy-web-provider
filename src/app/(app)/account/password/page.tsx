"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import s from "../account.module.css";

type Key = "oldPassword" | "newPassword" | "confirmPassword";
const FIELDS: [Key, string, string][] = [
  ["oldPassword", "Current password", "current-password"],
  ["newPassword", "New password", "new-password"],
  ["confirmPassword", "Confirm new password", "new-password"],
];

// Change password. The proxy stores the new session token the backend returns.
export default function Page() {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<Record<Key, string>>({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [err, setErr] = useState<Partial<Record<Key | "form", string>>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof err = {
      oldPassword: v.oldPassword ? undefined : "Enter your current password.",
      newPassword: v.newPassword.length < 8 ? "Use at least 8 characters." : v.newPassword.length > 128 ? "Use 128 characters or fewer." : undefined,
      confirmPassword: v.confirmPassword !== v.newPassword ? "The passwords don't match." : undefined,
    };
    setErr(next);
    const first = FIELDS.find(([k]) => next[k]);
    if (first) { document.getElementById(first[0])?.focus(); return; }
    setBusy(true);
    try {
      await api("vendor/auth/change-password", { method: "PUT", body: v });
      toast("Password changed.");
      router.push("/account");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
      const field: Key | "form" = e instanceof ApiError && e.status === 403 ? "oldPassword" : /password/i.test(message) ? "newPassword" : "form";
      setErr({ [field]: message });
      if (field !== "form") document.getElementById(field)?.focus();
      setBusy(false);
    }
  };

  return (
    <div className={s.wrap}>
      <Link className={s.back} href="/account"><ArrowLeft size={20} aria-hidden />Account</Link>
      <h1>Password</h1>
      <form className={`box pad ${s.form}`} onSubmit={submit} noValidate>
        {FIELDS.map(([k, label, auto]) => (
          <div className="field" key={k}>
            <span><label htmlFor={k}>{label}</label></span>
            <input id={k} className="input" type="password" autoComplete={auto} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}
              aria-invalid={!!err[k]} aria-describedby={err[k] ? `${k}-err` : k === "newPassword" ? "np-hint" : undefined} />
            {k === "newPassword" && !err[k] && <small id="np-hint" className="hint">At least 8 characters.</small>}
            {err[k] && <small id={`${k}-err`} className="err">{err[k]}</small>}
          </div>
        ))}
        {err.form && <p className="err" role="alert">{err.form}</p>}
        <div><button className="btn p lg" disabled={busy} aria-busy={busy}>Change password</button></div>
      </form>
    </div>
  );
}
