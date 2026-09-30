"use client";
import { useState, type FormEvent } from "react";
import { api, FILES, fileRule } from "@/lib/api";
import { ASKS_LEAD } from "@/lib/pay";
import type { PayoutAccount } from "@/lib/types";
import { Field, errText } from "./Field";
import { UploadNote, useUploads } from "./Upload";
import s from "./forms.module.css";

type Fix = NonNullable<PayoutAccount["requirements"][number]["fix"]>;
type Saved = (a: PayoutAccount) => void;

// Stripe's follow-up asks the Buddy answers here (only the ones Stripe lists): full SSN/ITIN, photo ID, proof of
// address. Each goes straight to vendor/payouts/*; the account comes back and the parent shows its new status.
export function StripeAsks({ acct, onSaved }: { acct: PayoutAccount; onSaved: Saved }) {
  const [sent, setSent] = useState(false);
  const fixes = new Set(acct.requirements.flatMap((r) => (r.fix ? [r.fix] : [])));
  if (!fixes.size && !sent) return null;
  const saved = (a: PayoutAccount) => { setSent(true); onSaved(a); };
  return (
    <section className={`box pad ${s.asks}`} aria-labelledby="asks-h">
      <h2 id="asks-h">{ASKS_LEAD}</h2>
      {sent && (
        <p role="status"><span className="tag t-wait">In review</span> Sent to Stripe. It usually checks in a few minutes.</p>
      )}
      {fixes.has("id_number") && <IdNumber onSaved={saved} />}
      {fixes.has("id_document") && <Doc fix="id_document" savedId={!!acct.savedId} onSaved={saved} />}
      {fixes.has("address_document") && <Doc fix="address_document" savedId={false} onSaved={saved} />}
    </section>
  );
}

function IdNumber({ onSaved }: { onSaved: Saved }) {
  const [v, setV] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const idNumber = v.replace(/\D/g, "");
    if (idNumber.length !== 9) return setError("Enter all 9 digits of your SSN or ITIN.");
    setBusy(true);
    setError("");
    try {
      const { data } = await api<PayoutAccount>("vendor/payouts/id-number", { method: "POST", body: { idNumber } });
      setV("");
      onSaved(data);
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form method="post" className={s.asks} onSubmit={submit} noValidate>
      <Field id="id-number" label="Full SSN or ITIN" required error={error} hint="Used only by Stripe to confirm who you are. We never store it.">
        <input type="password" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={11} value={v} disabled={busy}
          onChange={(e) => { setV(e.target.value); setError(""); }} />
      </Field>
      <span className={s.buttons}><button className="btn p" aria-busy={busy} disabled={busy}>Send to Stripe</button></span>
    </form>
  );
}

const SLOTS = {
  id_document: [["front", "Front"], ["back", "Back (not needed for a passport)"]],
  address_document: [["front", "Utility bill or bank statement"]],
} as const;

// Photo ID (front, back) or proof of address. With an ID from onboarding on file, sending that is one tap; "Upload a
// different ID" opens the slots. New files go to the private documents folder and change nothing in onboarding.
function Doc({ fix, savedId, onSaved }: { fix: Exclude<Fix, "id_number">; savedId: boolean; onSaved: Saved }) {
  const id = fix === "id_document";
  const kind = id ? "idPhoto" : "proof";
  const { slots, pick, busy: uploading } = useUploads<"front" | "back">("documents", kind);
  const [other, setOther] = useState(!savedId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: object) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api<PayoutAccount>("vendor/payouts/document", { method: "POST", body: { purpose: id ? "identity" : "address", ...body } });
      onSaved(data);
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!slots.front?.url) return setError(id ? "Add the front of your ID." : "Add your bill or statement.");
    send({ front: slots.front.url, ...(slots.back?.url && { back: slots.back.url }) });
  }

  return (
    <div className={s.asks}>
      <div>
        <h3>{id ? "Photo ID" : "Proof of address"}</h3>
        <p className="hint">
          {id ? "A driver's license, state ID or passport. A clear color photo of the whole card."
            : "A utility bill or bank statement from the last 3 months showing your name and address."}
        </p>
      </div>
      {!other ? (
        <span className={s.buttons}>
          <button type="button" className="btn p" aria-busy={busy} disabled={busy} onClick={() => send({ useSaved: true })}>Send the ID you already uploaded</button>
          <button type="button" className="btn" disabled={busy} onClick={() => setOther(true)}>Upload a different ID</button>
        </span>
      ) : (
        <form method="post" className={s.asks} onSubmit={submit} noValidate>
          <ul className={s.docs}>
            {SLOTS[fix].map(([k, label]) => {
              const d = slots[k];
              return (
                <li key={k} className={`box ${s.doc}`} aria-busy={d?.busy || undefined}>
                  <div>
                    <b>{label}</b>
                    <UploadNote slot={d} id={`err-${fix}-${k}`} idle={<p className="hint">{fileRule(kind)}</p>} onRetry={(f) => pick(k, f)} />
                  </div>
                  <label className="btn">
                    {d?.url ? "Replace" : "Upload"}
                    <input className="sr" type="file" accept={FILES[kind].accept} disabled={d?.busy || busy}
                      aria-invalid={d?.error ? true : undefined} aria-describedby={d?.error ? `err-${fix}-${k}` : undefined}
                      onChange={(e) => { pick(k, e.target.files?.[0]); e.target.value = ""; }} />
                    <span className="sr"> {label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <span className={s.buttons}>
            <button className="btn p" aria-busy={busy} disabled={busy || uploading}>Send to Stripe</button>
            {savedId && <button type="button" className="btn" disabled={busy} onClick={() => setOther(false)}>Use the ID you already uploaded</button>}
          </span>
        </form>
      )}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
