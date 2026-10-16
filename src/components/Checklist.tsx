"use client";
// v3 Home before approval: the amber banner, "Get verified" one next step at a time,
// one small card (email; the website has no web push, so no notifications card), and "Before your first job" once sent.
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CaretRight, CheckCircle, Circle, HourglassMedium, X } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { longDate } from "@/lib/format";
import type { Onboarding, Vendor } from "@/lib/types";
import { emailError } from "@/app/(auth)/form";
import { CodeInput, sendCode, type Sent } from "./Code";
import { useToast } from "./Toast";
import { useVendor } from "./Vendor";
import s from "./Checklist.module.css";

type Verify = NonNullable<Onboarding["verify"]>;
const NEXT: Record<NonNullable<Verify["next"]>, [string, string, string]> = {
  details: ["Your name and address", "About a minute", "/get-verified/details"],
  services: ["Your services", "What you do and your hourly rate", "/get-verified/services"],
  id: ["A photo of your ID", "Driver's license, state ID or passport", "/get-verified/id"],
};
const LEFT = [" Three quick things to go.", " Two quick things to go.", " One quick thing to go."]; // by items done; 3 done: nothing

// A server without v3 has no `verify`: the v2 stage says the same thing (v2 submits on the third item).
function verifyOf(o: Onboarding): Verify {
  if (o.verify) return o.verify;
  const at = ["details", "services", "documents", "submitted"].indexOf(o.stage);
  const next = (["details", "services", "id", null] as const)[at];
  return { details: at > 0, services: at > 1, id: at > 2, done: at, total: 3, next, submitted: at === 3, submittedAt: null };
}
const firstJobOf = (o: Onboarding) => o.firstJob ?? { payouts: o.checklist.payouts };

export function Checklist({ vendor, onboarding: o }: { vendor: Vendor; onboarding: Onboarding }) {
  const { reload } = useVendor();
  const [sent, setSent] = useState(false); // just sent for verification: the Submitted screen
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(false);
  const v = verifyOf(o);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api("vendor/auth/submit", { method: "POST" });
      await reload().catch(() => {});
      setSent(true);
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message); // "Add your name and address first." and the like
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className={s.sent}>
        <HourglassMedium size={56} className="muted" aria-hidden />
        <h1>Application sent</h1>
        <p className="sub">In review, usually within 1 business day. We let you know when it&apos;s done.</p>
        <p className="sub">Meanwhile, set up how you get paid. Customers can book you once you&apos;re approved and it&apos;s done.</p>
        <button type="button" className="btn p lg" onClick={() => setSent(false)}>Back to Home</button>
      </div>
    );
  }

  const next = v.next && NEXT[v.next];
  return (
    <div className={s.wrap}>
      <div>
        <h1>{vendor.firstName ? `Hi, ${vendor.firstName}` : "Welcome"}</h1>
        <p className="sub">{longDate(new Date())}</p>
      </div>
      {o.review === "rejected" ? (
        <p className={`${s.banner} ${s.bad}`} role="status">
          Your application needs changes. <Link href="/account/help">Contact support</Link> to continue.
        </p>
      ) : (
        <p className={s.banner} role="status">
          {v.submitted
            ? "We're checking your details, usually within 1 business day. Job requests start once you're verified."
            : `You'll start getting job requests once you're verified.${LEFT[v.done] ?? ""}`}
        </p>
      )}

      {!v.submitted && (
        <section className={`box ${s.card}`} aria-labelledby="gv">
          <div className={s.head}><h2 id="gv">Get verified</h2><span className="muted">{v.done} of 3</span></div>
          <div className={s.bar} aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={i < v.done ? s.on : undefined} />)}</div>
          {next ? (
            <>
              <div>
                <p className={s.label}>Next</p>
                <h3>{next[0]}</h3>
                <p className="muted">{next[1]}</p>
              </div>
              <Link className="btn p lg block" href={next[2]}>{v.done ? "Continue" : "Start"}<span className="sr">: {next[0]}</span></Link>
            </>
          ) : (
            <>
              <p>Everything&apos;s in. Send it and we&apos;ll check it, usually within 1 business day.</p>
              <button type="button" className="btn p lg block" onClick={submit} disabled={busy} aria-busy={busy}>Send for verification</button>
              {error && <p className="err" role="alert">{error}</p>}
            </>
          )}
        </section>
      )}

      {!o.checklist.email && (
        <div className={`box ${s.small}`}>
          <p>Add your email to get updates on your verification.</p>
          <button type="button" className="btn" onClick={() => setSheet(true)}>Add</button>
        </div>
      )}

      {v.submitted && <FirstJob o={o} />}
      {sheet && <EmailSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

/** "Before your first job": Get paid only (the profile photo is optional, in Account), ticked when done. */
function FirstJob({ o }: { o: Onboarding }) {
  const rows: [boolean, string, string, string][] = [[firstJobOf(o).payouts, "Get paid", "Where we send your money", "/account/bank"]];
  return (
    <section className={`box ${s.card}`} aria-labelledby="fj">
      <div className={s.head}><h2 id="fj">Before your first job</h2></div>
      <ul className={s.list}>
        {rows.map(([done, title, sub, href]) => (
          <li key={href}>
            <Link href={href}>
              {done ? <CheckCircle size={22} weight="fill" className={s.done} aria-hidden /> : <Circle size={22} className={s.open} aria-hidden />}
              <span><b>{title}<span className="sr">{done ? ", done" : ""}</span></b><small>{sub}</small></span>
              <CaretRight size={16} className={s.go} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Approved: "Before your first job" above the board until Get paid is done, then the normal Home. */
export function SetupNote({ onboarding }: { onboarding: Onboarding }) {
  if (firstJobOf(onboarding).payouts) return null;
  return <div className={s.above}><FirstJob o={onboarding} /></div>;
}

/** Add your email: one field, Send code, then the code in the same sheet; closes with "Email added." No switches here
 *  (both email choices start on; Account › Email keeps the switches). Native <dialog>: focus trap and Esc. */
function EmailSheet({ onClose }: { onClose: () => void }) {
  const { reload } = useVendor();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const bad = tried ? emailError(email) : undefined;
  const send = () => sendCode(() => api("vendor/auth/email/send-code", { method: "POST", body: { email: email.trim() } }));

  async function onSend(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setFail("");
    if (emailError(email)) return document.getElementById("sheet-email")?.focus();
    setBusy(true);
    try {
      setSent(await send());
    } catch (x) {
      setFail((x as Error).message); // "This email is already linked to another Buddy account."
    }
    setBusy(false);
  }
  async function verify(code: string) {
    await api("vendor/auth/email/verify", { method: "POST", body: { code, jobEmails: true, offerEmails: true } }); // both on by default, also on a server that doesn't default them
    await reload().catch(() => {});
    toast("Email added.");
    onClose();
  }

  const msg = bad || fail;
  return (
    <dialog ref={ref} className={s.sheet} aria-labelledby="sheet-t" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className={s.sheetHead}>
        <h2 id="sheet-t">Add your email</h2>
        <button type="button" className={s.x} onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
      </div>
      {!sent ? (
        <form method="post" className={s.stack} onSubmit={onSend} noValidate>
          <div className="field">
            <label htmlFor="sheet-email" className={s.fieldLabel}>Email</label>
            <input id="sheet-email" className="input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" maxLength={100}
              value={email} onChange={(e) => { setEmail(e.target.value); setFail(""); }} autoFocus
              aria-invalid={!!msg || undefined} aria-describedby={msg ? "sheet-email-err" : undefined} />
            {msg && <p id="sheet-email-err" className="err" role="alert">{msg}</p>}
          </div>
          <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Sending code" : "Send code"}</button>
        </form>
      ) : (
        <CodeInput label="Enter the code" sent={sent} resend={send} verify={verify} submit="Verify email">
          <button type="button" className={s.textBtn} onClick={() => setSent(null)}>Change email</button>
        </CodeInput>
      )}
    </dialog>
  );
}
