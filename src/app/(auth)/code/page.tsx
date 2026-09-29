"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { countdown } from "@/lib/format";
import { codeUntil, landing, say, startCode } from "../form";
import { CodeBoxes, EMPTY_CODE as EMPTY } from "../CodeBoxes";
import s from "../auth.module.css";

// One screen for both code steps: flow=verify (new account, unverified login) and flow=reset (forgot password).
export default function Code() {
  const router = useRouter();
  const reset = useSearchParams().get("flow") === "reset";
  const [digits, setDigits] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [fail, setFail] = useState("");
  const [note, setNote] = useState("");
  const [left, setLeft] = useState<number | null>(null); // ms; null until read on the client
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!codeUntil()) startCode();
    const tick = () => setLeft(Math.max(0, codeUntil() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  async function verify(code: string) {
    if (busy) return;
    setFail("");
    setNote("");
    if (!/^\d{6}$/.test(code)) {
      setFail("Enter all 6 digits.");
      boxes.current[digits.findIndex((d) => !d)]?.focus();
      return;
    }
    setBusy(true);
    try {
      const { data } = await api<{ step?: number }>("vendor/auth/verify-otp", { method: "POST", body: { loginOtp: code } });
      try { sessionStorage.removeItem("ab_pro_code_until"); } catch {}
      router.replace(reset ? "/reset" : landing(data?.step, "/"));
    } catch (err) {
      setFail(say(err));
      setDigits(EMPTY);
      setBusy(false);
      setTimeout(() => boxes.current[0]?.focus());
    }
  }

  async function resend() {
    setSending(true);
    setFail("");
    setNote("");
    try {
      await api("vendor/auth/resend-otp", { method: "PUT" });
      startCode();
      setNote("We sent a new code.");
    } catch (err) {
      // 429: the last code still works. Keep the countdown (to the server's figure) and show its note.
      const d = err instanceof ApiError ? (err.data as { codeValidFor?: number } | null) : null;
      if (d?.codeValidFor) startCode(d.codeValidFor);
      setNote(say(err));
    }
    setLeft(Math.max(0, codeUntil() - Date.now()));
    setSending(false);
  }

  return (
    <>
      <title>Enter the code · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1 id="code-title">Enter the 6-digit code</h1>
        <p className="sub">
          {reset ? "If this email has an account, a code is on its way." : "Enter the 6-digit code we emailed to you, or tap Verify my email in that email."} If it has not arrived, check your spam folder.
        </p>
      </div>
      <form method="post" className={s.form} onSubmit={(e: FormEvent) => { e.preventDefault(); verify(digits.join("")); }} noValidate>
        <CodeBoxes
          digits={digits}
          setDigits={(d) => { setDigits(d); setFail(""); }}
          onComplete={verify}
          labelledBy="code-title"
          describedBy={fail ? "code-err" : undefined}
          invalid={!!fail}
          disabled={busy}
          autoFocus
          boxes={boxes}
        />
        {fail && <p id="code-err" className={s.alert} role="alert">{fail}</p>}
        {note && !fail && <p className={s.note} role="status">{note}</p>}
        <button className="btn p lg block" disabled={busy} aria-busy={busy}>{busy ? "Checking your code" : "Continue"}</button>
        <div className={s.resend}>
          {left === null ? null : left > 0 ? (
            <span>You can send a new code in {countdown(left)}</span>
          ) : (
            <button type="button" className={s.textBtn} onClick={resend} disabled={sending} aria-busy={sending}>
              {sending ? "Sending" : "Send a new code"}
            </button>
          )}
        </div>
      </form>
      <p className={s.foot}>
        <Link href="/login" className={s.link}>Back to log in</Link>
      </p>
    </>
  );
}
