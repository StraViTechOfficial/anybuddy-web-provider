"use client";
// Code entry for every code screen: phone login, the email code, a new phone, add email, payout changes.
// A2: "Send a new code" waits the server's codeValidFor (30 s when it is missing); the "already sent" note shows only on
// HTTP 429. Typing, autofill (autocomplete="one-time-code") and paste all spread the digits over the six boxes.
import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { ApiError, type Reply } from "@/lib/api";
import s from "./Code.module.css";

export const EMPTY_CODE = ["", "", "", "", "", ""];
/** A code is out: when "Send a new code" opens (ms time), the server's line, its data, and whether it was sent before (429). */
export type Sent = { until: number; note: string; data?: unknown; again?: boolean };

const validFor = (d: unknown) => (d as { codeValidFor?: unknown } | null)?.codeValidFor;
const sent = (d: unknown, note: string, again = false): Sent => {
  const n = validFor(d);
  return { until: Date.now() + (typeof n === "number" && n > 0 ? n : 30) * 1000, note, data: d, again };
};
const say = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

/** Runs a send call. HTTP 429 with codeValidFor = the last code still works: shown like a send, with the server's note. */
export async function sendCode(call: () => Promise<Reply<unknown>>): Promise<Sent> {
  try {
    const r = await call();
    return sent(r.data, r.message);
  } catch (e) {
    if (e instanceof ApiError && e.status === 429 && validFor(e.data)) return sent(e.data, e.message, true);
    throw e;
  }
}

/** "Send a new code in 0:24", then the button. */
export function Resend({ until, onResend, busy }: { until: number; onResend: () => void; busy?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  const left = Math.ceil((until - now) / 1000);
  if (left > 0) return <span>Send a new code in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>;
  return <button type="button" className={s.textBtn} onClick={onResend} disabled={busy} aria-busy={busy}>{busy ? "Sending" : "Send a new code"}</button>;
}

type BoxProps = {
  id?: string; // the first box's id, for "first wrong field" focus
  digits: string[]; setDigits: (d: string[]) => void; onComplete?: (code: string) => void;
  labelledBy: string; describedBy?: string; invalid?: boolean; disabled?: boolean; autoFocus?: boolean;
  boxes?: React.RefObject<(HTMLInputElement | null)[]>;
};

export function CodeBoxes({ id, digits, setDigits, onComplete, labelledBy, describedBy, invalid, disabled, autoFocus, boxes: given }: BoxProps) {
  const own = useRef<(HTMLInputElement | null)[]>([]);
  const boxes = given ?? own;

  function fill(i: number, raw: string) {
    const got = raw.replace(/\D/g, "").slice(0, 6 - i).split("");
    if (!got.length) return;
    const next = [...digits];
    got.forEach((d, j) => (next[i + j] = d));
    setDigits(next);
    boxes.current[Math.min(i + got.length, 5)]?.focus();
    if (next.every(Boolean)) onComplete?.(next.join(""));
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

  return (
    <div className={s.boxes} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {digits.map((d, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => { boxes.current[i] = el; }}
          value={d}
          onChange={(e) => fill(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={(e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); fill(i, e.clipboardData.getData("text")); }}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of 6`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/** A code that was just sent (owner's code-step standard, v2.1): title, `head` (where it went + "Change number"), the six
 *  boxes, the error or the server's note, one resend line with `children` grouped under it, then the submit button.
 *  `verify` throws to show its message; on success the parent moves on. With `head` the title is a heading. */
export function CodeInput({ label, head, sent: first, resend, verify, submit, children }: {
  label: string; head?: ReactNode; sent: Sent; resend: () => Promise<Sent>; verify: (code: string) => Promise<void>; submit: string; children?: ReactNode;
}) {
  const id = useId();
  const [digits, setDigits] = useState(EMPTY_CODE);
  const [at, setAt] = useState(first);
  const [busy, setBusy] = useState<"" | "check" | "send">("");
  const [fail, setFail] = useState("");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => setAt(first), [first]);

  async function check(code: string) {
    if (busy) return;
    setFail("");
    if (!/^\d{6}$/.test(code)) {
      setFail("Enter all 6 digits.");
      return boxes.current[Math.max(0, digits.findIndex((d) => !d))]?.focus();
    }
    setBusy("check");
    try {
      await verify(code); // success: the parent moves on, so the button stays busy
    } catch (e) {
      setFail(say(e));
      setDigits(EMPTY_CODE);
      setBusy("");
      setTimeout(() => boxes.current[0]?.focus());
    }
  }
  async function again() {
    setBusy("send");
    setFail("");
    try {
      setAt(await resend());
      setDigits(EMPTY_CODE);
      boxes.current[0]?.focus();
    } catch (e) {
      setFail(say(e));
    }
    setBusy("");
  }

  return (
    <form method="post" className={s.code} onSubmit={(e) => { e.preventDefault(); check(digits.join("")); }} noValidate>
      {head ? <h2 id={`${id}-l`} className={s.title}>{label}</h2> : <p id={`${id}-l`} className={s.label}>{label}</p>}
      {head}
      <CodeBoxes digits={digits} setDigits={(d) => { setDigits(d); setFail(""); }} onComplete={check} labelledBy={`${id}-l`}
        describedBy={`${id}-n`} invalid={!!fail} disabled={busy === "check"} autoFocus boxes={boxes} />
      {/* With `head` the "We texted it to" line says where it went; the server's note shows only for a 429 ("already sent"). */}
      <p id={`${id}-n`} className={fail ? "err" : "hint"} role={fail ? "alert" : "status"}>{fail || (!head || at.again ? at.note : "")}</p>
      <div className={s.row}>
        <Resend until={at.until} onResend={again} busy={busy === "send"} />
        {children}
      </div>
      <button className="btn p lg block" disabled={!!busy} aria-busy={busy === "check"}>{busy === "check" ? "Checking" : submit}</button>
    </form>
  );
}
