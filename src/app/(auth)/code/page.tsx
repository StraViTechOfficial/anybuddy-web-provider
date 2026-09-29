"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { countdown } from "@/lib/format";
import { codeUntil, landing, say, startCode } from "../form";
import s from "../auth.module.css";

const EMPTY = ["", "", "", "", "", ""];

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

  // Typing, autofill and paste all land here: spread the digits from box `i` onwards.
  function fill(i: number, raw: string) {
    const got = raw.replace(/\D/g, "").slice(0, 6 - i).split("");
    if (!got.length) return;
    const next = [...digits];
    got.forEach((d, j) => (next[i + j] = d));
    setDigits(next);
    setFail("");
    boxes.current[Math.min(i + got.length, 5)]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      const at = digits[i] || i === 0 ? i : i - 1;
      next[at] = "";
      setDigits(next);
      boxes.current[at]?.focus();
    } else if (e.key === "ArrowLeft") boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight") boxes.current[i + 1]?.focus();
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
          {reset ? "If this email has an account, a code is on its way." : "We sent a 6-digit code to your email."} Check your spam folder if it hasn&apos;t arrived.
        </p>
      </div>
      <form className={s.form} onSubmit={(e: FormEvent) => { e.preventDefault(); verify(digits.join("")); }} noValidate>
        <div className={s.boxes} role="group" aria-labelledby="code-title" aria-describedby={fail ? "code-err" : undefined}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { boxes.current[i] = el; }}
              value={d}
              onChange={(e) => fill(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={(e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); fill(i, e.clipboardData.getData("text")); }}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1} of 6`}
              aria-invalid={!!fail || undefined}
              disabled={busy}
            />
          ))}
        </div>
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
