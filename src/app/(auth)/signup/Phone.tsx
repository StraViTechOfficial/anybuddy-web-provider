"use client";
// FEA-40 (D-52): the phone is proven on the sign-up form, before the account exists. Send code -> six boxes right
// under the field -> "Verified" with the number locked. The proof (a 30-minute phone token, not a login token)
// lives only in the parent's memory and goes with the sign-up request.
import { useEffect, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { countdown } from "@/lib/format";
import { Req } from "@/components/forms/Field";
import { CodeBoxes, EMPTY_CODE } from "../CodeBoxes";
import { say } from "../form";
import s from "../auth.module.css";

export const phoneDigits = (v: string) => {
  const d = v.replace(/\D/g, "");
  return (d.length > 10 && d[0] === "1" ? d.slice(1) : d).slice(0, 10);
};
// (617) 555-0123, built up as the Buddy types.
const pretty = (v: string) => {
  const d = phoneDigits(v);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

type Props = {
  value: string;
  setValue: (v: string) => void;
  field: { onBlur: React.FocusEventHandler<HTMLInputElement>; "aria-invalid"?: boolean; "aria-describedby"?: string };
  error: React.ReactNode;
  token: string;
  setToken: (t: string) => void;
};

export function Phone({ value, setValue, field, error, token, setToken }: Props) {
  const [until, setUntil] = useState(0); // a code is out while > 0 (ms time it stops working)
  const [now, setNow] = useState(0);
  const [digits, setDigits] = useState(EMPTY_CODE);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [note, setNote] = useState("");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const phone = phoneDigits(value);
  const sent = until > 0 && !token;
  const locked = sent || !!token;

  useEffect(() => {
    if (!sent) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sent]);

  async function send() {
    setBusy(true);
    setFail("");
    setNote("");
    try {
      const { data } = await api<{ codeValidFor: number }>("vendor/auth/phone/send-code", { method: "POST", body: { phone } });
      setUntil(Date.now() + data.codeValidFor * 1000);
      setNow(Date.now());
      setNote("We texted a code to this number.");
      setTimeout(() => boxes.current[0]?.focus());
    } catch (err) {
      // 429: the last code still works. Show the boxes and the time it has left.
      const d = err instanceof ApiError ? (err.data as { codeValidFor?: number } | null) : null;
      if (d?.codeValidFor) {
        setUntil(Date.now() + d.codeValidFor * 1000);
        setNow(Date.now());
        setNote(say(err));
      } else setFail(say(err));
    }
    setDigits(EMPTY_CODE);
    setBusy(false);
  }

  async function verify(code: string) {
    setBusy(true);
    setFail("");
    try {
      const { data } = await api<{ phoneToken: string }>("vendor/auth/phone/verify", { method: "POST", body: { phone, code } });
      setToken(data.phoneToken);
      setNote("");
    } catch (err) {
      setFail(say(err));
      setDigits(EMPTY_CODE);
      setTimeout(() => boxes.current[0]?.focus());
    }
    setBusy(false);
  }

  function change() {
    setToken("");
    setUntil(0);
    setDigits(EMPTY_CODE);
    setFail("");
    setNote("");
    setTimeout(() => document.getElementById("phone")?.focus());
  }

  const left = until - now;
  return (
    <div className="field">
      <label htmlFor="phone" className={s.label}>Phone number<Req /></label>
      <div className={s.phoneRow}>
        <span className={s.phone}>
          <b aria-hidden>+1 US</b>
          <input
            {...field}
            id="phone"
            name="phone"
            value={value}
            onChange={(e) => setValue(pretty(e.target.value))}
            className="input"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="(617) 555-0123"
            maxLength={14}
            readOnly={locked}
            aria-readonly={locked || undefined}
            required
          />
        </span>
        {!locked && (
          <button type="button" className="btn lg" onClick={send} disabled={busy || phone.length !== 10} aria-busy={busy}>
            {busy ? "Sending" : "Send code"}
          </button>
        )}
      </div>
      {!locked && error}
      {token && (
        <p className={s.verified} role="status">
          <CheckCircle size={20} weight="fill" aria-hidden /> Verified
          <button type="button" className={s.textBtn} onClick={change}>Change number</button>
        </p>
      )}
      {sent && (
        <div className={s.phoneCode}>
          <p id="phone-code-label" className="hint">Enter the 6-digit code we texted to you</p>
          <CodeBoxes
            digits={digits}
            setDigits={(d) => { setDigits(d); setFail(""); }}
            onComplete={verify}
            labelledBy="phone-code-label"
            describedBy={fail ? "phone-code-err" : undefined}
            invalid={!!fail}
            disabled={busy}
            boxes={boxes}
          />
          {fail && <p id="phone-code-err" className="err" role="alert">{fail}</p>}
          {note && !fail && <p className="hint" role="status">{note}</p>}
          <div className={s.resend}>
            {left > 0 ? <span>You can send a new code in {countdown(left)}</span> : (
              <button type="button" className={s.textBtn} onClick={send} disabled={busy}>Send a new code</button>
            )}
            <button type="button" className={s.textBtn} onClick={change}>Change number</button>
          </div>
        </div>
      )}
      {!sent && !token && fail && <p className="err" role="alert">{fail}</p>}
    </div>
  );
}
