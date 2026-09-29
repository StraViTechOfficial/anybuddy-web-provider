"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useVendor } from "@/components/Vendor";
import s from "../account.module.css";

// The website's "For Buddies" FAQ (same as the iOS app), headed as statements.
const FAQ: [string, string][] = [
  ["Signing up as a Buddy", "Create your provider profile, list your services, share license and credential details for skilled jobs, and submit your documents for verification. Once approved, your profile goes live and you can start accepting jobs."],
  ["Fees for joining", "Signing up as a Buddy is free. Any-Buddy takes a small service fee from each completed booking, and you keep the rest."],
  ["A rude or unsafe customer", "Your safety is our priority too. If a customer behaves inappropriately, contact our support team right away. Accounts that break our community standards are removed from the platform."],
];

function Help() {
  const booking = useSearchParams().get("booking");
  const { vendor } = useVendor();
  const toast = useToast();
  const [subject, setSubject] = useState(booking ? `Booking ${booking}` : "");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<{ subject?: string; message?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { subject: subject.trim() ? undefined : "Enter a subject.", message: message.trim() ? undefined : "Enter your message." };
    setErr(next);
    if (next.subject || next.message) { document.getElementById(next.subject ? "subject" : "message")?.focus(); return; }
    if (!vendor) return;
    setBusy(true);
    try {
      await api("user/support/send-message", {
        method: "POST",
        body: { name: `${vendor.firstName} ${vendor.lastName}`.trim(), email: vendor.email, description: `${subject.trim()}\n\n${message.trim()}`, role: 2 },
      });
      toast("Message sent. We'll reply by email.");
      setMessage("");
      setSubject("");
    } catch (e) {
      setErr({ form: e instanceof ApiError ? e.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.wrap}>
      <Link className={s.back} href="/account"><ArrowLeft size={20} aria-hidden />Account</Link>
      <h1>Help and support</h1>
      <section aria-labelledby="contact-h">
        <h2 id="contact-h">Contact support</h2>
        <form className={`box pad ${s.form}`} onSubmit={submit} noValidate>
          <p className="muted">Our team replies by email to {vendor?.email ?? "your account email"}.</p>
          <div className="field">
            <span><label htmlFor="subject">Subject</label></span>
            <input id="subject" className="input" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)}
              aria-invalid={!!err.subject} aria-describedby={err.subject ? "subject-err" : undefined} />
            {err.subject && <small id="subject-err" className="err">{err.subject}</small>}
          </div>
          <div className="field">
            <span><label htmlFor="message">Message</label></span>
            <textarea id="message" className="input" rows={6} maxLength={4500} value={message} onChange={(e) => setMessage(e.target.value)}
              aria-invalid={!!err.message} aria-describedby={err.message ? "message-err" : "message-hint"} />
            {err.message ? <small id="message-err" className="err">{err.message}</small> : <small id="message-hint" className="hint">Tell us what happened and how we can help.</small>}
          </div>
          {err.form && <p className="err" role="alert">{err.form}</p>}
          <div><button className="btn p lg" disabled={busy || !vendor} aria-busy={busy}>Send message</button></div>
        </form>
      </section>
      <section aria-labelledby="faq-h">
        <h2 id="faq-h">Buddy FAQ</h2>
        <div className={`box ${s.faq}`}>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
        <p className={`hint ${s.note}`}>You can also email <a href="mailto:info@any-buddy.com">info@any-buddy.com</a>.</p>
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><Help /></Suspense>;
}
