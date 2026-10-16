"use client";
// Changing where earnings go (bank or debit card) is confirmed with a code instead of the password. The code is sent
// to the email on file, or else by text. It goes with the save as `changeCode`, and the server checks it there.
import { useState } from "react";
import { api } from "@/lib/api";
import { CodeBoxes, EMPTY_CODE, Resend, sendCode, type Sent } from "@/components/Code";
import { errText } from "./Field";
import s from "./forms.module.css";

export const CODE_MISSING = "Enter the code we sent you to change payout details.";

export function ChangeCode({ value, onChange, error }: { value: string[]; onChange: (d: string[]) => void; error?: string }) {
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  async function send() {
    setBusy(true);
    setFail("");
    try {
      setSent(await sendCode(() => api("vendor/payouts/change-code", { method: "POST", body: {} })));
      onChange(EMPTY_CODE);
    } catch (e) {
      setFail(errText(e));
    }
    setBusy(false);
  }
  const to = (sent?.data as { sentTo?: string } | null)?.sentTo;
  const msg = fail || error;
  return (
    <div className="field">
      <span className={s.label} id="changeCode-l">Confirm the change</span>
      {!sent ? (
        <>
          <small className="hint" id="changeCode-hint">To change where your earnings go, confirm with a code. It goes to your email, or by text when there is no email.</small>
          <div>
            <button type="button" id="changeCode" className="btn" onClick={send} disabled={busy} aria-busy={busy}
              aria-describedby={msg ? "changeCode-err" : "changeCode-hint"}>{busy ? "Sending code" : "Send code"}</button>
          </div>
        </>
      ) : (
        <>
          <CodeBoxes id="changeCode" digits={value} setDigits={onChange} labelledBy="changeCode-l" invalid={!!msg}
            describedBy={msg ? "changeCode-err" : "changeCode-note"} />
          <small className="hint" id="changeCode-note" role="status">{!sent.again && to ? `We sent a code to ${to}.` : sent.note}</small>
          <span className="hint"><Resend until={sent.until} onResend={send} busy={busy} /></span>
        </>
      )}
      {msg && <small id="changeCode-err" className="err" role="alert">{msg}</small>}
    </div>
  );
}
