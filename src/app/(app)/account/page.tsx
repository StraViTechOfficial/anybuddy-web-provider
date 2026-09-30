"use client";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Bank, Bell, CaretRight, Clock, FileText, Lifebuoy, Lock, Scroll, SealCheck, SignOut, Star, Trash, User, Wrench, type Icon,
} from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useVendor } from "@/components/Vendor";
import s from "./account.module.css";

const BUSINESS: [string, string, Icon][] = [
  ["/account/profile", "Profile", User], ["/account/services", "Services and rates", Wrench], ["/hours", "Working hours", Clock],
  ["/account/documents", "Documents", FileText], ["/account/bank", "Bank details", Bank],
];
const HELP: [string, string, Icon][] = [["/account/reviews", "Reviews", Star], ["/account/help", "Help and support", Lifebuoy], ["/account/legal", "Terms and privacy", Scroll]];

const Row = ({ href, label, I }: { href: string; label: string; I: Icon }) => (
  <Link href={href}><span><I size={20} aria-hidden />{label}</span><CaretRight size={16} className="muted" aria-hidden /></Link>
);
const Group = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id}><h2 id={id}>{title}</h2><div className={`box ${s.list}`}>{children}</div></section>
);
const signOut = () => api("vendor/auth/logout", { method: "POST" }).catch(() => {}).then(() => window.location.assign("/login"));

export default function Page() {
  const { vendor, reload } = useVendor();
  const toast = useToast();
  const [notify, setNotify] = useState<boolean | null>(null);
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  if (!vendor) return <div className={`skeleton ${s.loading}`} aria-label="Loading account" />;

  const on = notify ?? !!vendor.notifyMe;
  const toggle = async () => {
    setNotify(!on);
    try {
      await api("vendor/notification/notify-status", { method: "PUT" });
      toast(on ? "Notifications are off." : "Notifications are on.");
      reload().catch(() => {});
    } catch (e) {
      setNotify(on);
      toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  };
  const remove = async (e: FormEvent) => {
    e.preventDefault();
    if (confirm.trim() !== "DELETE") { setError("Type DELETE in capital letters to confirm."); return; }
    setBusy("delete");
    try {
      await api("vendor/auth/delete", { method: "DELETE" });
      await signOut();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy("");
    }
  };
  const name = `${vendor.firstName} ${vendor.lastName}`.trim();

  return (
    <div className={`${s.wrap} ${s.hub}`}>
      <h1>Account</h1>
      <header className={s.head}>
        {vendor.logoUrl ? <img src={vendor.logoUrl} alt="" width={64} height={64} /> : <span className={s.initials} aria-hidden>{(vendor.firstName?.[0] ?? "") + (vendor.lastName?.[0] ?? "")}</span>}
        <div>
          <p className={s.name}>{name}</p>
          <p className="muted">{vendor.email}</p>
          {vendor.verificationStatus === 1 ? (
            <p className={s.verified}><SealCheck size={18} weight="fill" aria-hidden /><b>Verified Buddy</b><span>Your ID and documents were checked by Any-Buddy.</span></p>
          ) : vendor.verificationStatus === 2 ? (
            <p><span className="tag t-bad">Changes needed</span> <Link href="/account/help">Contact support</Link></p>
          ) : (
            <p><span className="tag t-wait">Under review</span> <span className="muted">We email you when you&apos;re approved.</span></p>
          )}
        </div>
      </header>

      <div className={s.cols}>
      <div className={s.col}>
      <Group id="g-biz" title="Your business">{BUSINESS.map(([h, l, I]) => <Row key={h} href={h} label={l} I={I} />)}</Group>
      <Group id="g-set" title="Settings">
        <label>
          <span><Bell size={20} aria-hidden /><span>Notifications<small id="notify-hint">New requests and job updates on your phone</small></span></span>
          <input type="checkbox" role="switch" className="sr" checked={on} onChange={toggle} aria-describedby="notify-hint" />
          <span className={s.sw} aria-hidden />
        </label>
        <Row href="/account/password" label="Password" I={Lock} />
      </Group>
      </div>
      <div className={s.col}>
      <Group id="g-help" title="Help">{HELP.map(([h, l, I]) => <Row key={h} href={h} label={l} I={I} />)}</Group>

      <div className={`box ${s.list} ${s.out}`}>
        <button type="button" onClick={() => { setBusy("out"); signOut(); }} aria-busy={busy === "out"}>
          <span><SignOut size={20} aria-hidden />Log out</span>
        </button>
        <button type="button" className={s.danger} aria-expanded={del} aria-controls="del-panel" onClick={() => { setDel(!del); setError(""); setConfirm(""); }}>
          <span><Trash size={20} aria-hidden />Delete account</span>
        </button>
        {del && (
          <form method="post" id="del-panel" className={s.del} onSubmit={remove} noValidate>
            <p><b>Deleting your account can&apos;t be undone.</b> Your profile comes off Any-Buddy, customers can no longer book you and you are logged out.</p>
            <p>Your balance is paid to your bank after each job. Wait until the last payout is in your bank: once the account is deleted you can&apos;t log in to check it.</p>
            <div className="field">
              <span><label htmlFor="del-confirm">Type DELETE to confirm</label></span>
              <input id="del-confirm" className="input" autoComplete="off" autoCapitalize="characters" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "del-err" : undefined} />
              {error && <p id="del-err" className="err">{error}</p>}
            </div>
            <div className={s.inline}>
              <button className="btn lg d" disabled={busy === "delete"} aria-busy={busy === "delete"}>Delete my account</button>
              <button type="button" className="btn lg" onClick={() => setDel(false)}>Keep my account</button>
            </div>
          </form>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
