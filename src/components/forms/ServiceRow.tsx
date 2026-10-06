"use client";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, PencilSimple, X } from "@phosphor-icons/react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { VendorService } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Field, errText, rateError as rateErr } from "./Field";
import s from "./forms.module.css";

/** A server error line; D-49's license refusal links to Documents. */
export function ServerError({ text }: { text: string }) {
  return (
    <p className="err" role="alert">
      {text}{/upload your license/i.test(text) && <> <Link href="/account/documents">Go to Documents</Link></>}
    </p>
  );
}

// One service: name, category, rate, description, and whether customers see it (FEA-36).
// Owner 6 Oct: the rate edits in place (amount, ✓ saves, ✕ restores; Enter / Esc), one row at a time (`rateOpen`,
// held by ServicesEditor). Edit opens the description inline; Remove and Hide hand off to the Undo toast.
export function ServiceRow({ service: x, onSaved, onRemove, rateOpen, onRateOpen }: {
  service: VendorService; onSaved: () => void; onRemove: () => void; rateOpen: boolean; onRateOpen: (open: boolean) => void;
}) {
  const toast = useToast();
  const [edit, setEdit] = useState<{ desc: string } | null>(null);
  const [rate, setRate] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const [rateSaved, setRateSaved] = useState(false);
  useEffect(() => { // opening (here or after another row closed) starts from the saved rate
    if (rateOpen) { setRate(String(Math.round(x.price))); setRateError(""); setRateSaved(false); }
  }, [rateOpen, x.price]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [on, setOn] = useState(x.isActive !== 0);
  const [showError, setShowError] = useState("");
  useEffect(() => setOn(x.isActive !== 0), [x.isActive]);
  const rid = `rate-${x._id}`;
  const name = x.subcategory.serviceName;

  async function show(next: boolean, undo = true) {
    setOn(next);
    setShowError("");
    try {
      await api("vendor/services/update", { method: "PUT", body: { serviceId: x._id, isActive: next ? 1 : 0 } });
      if (undo) toast(`${name} ${next ? "is shown to" : "is hidden from"} customers.`, () => show(!next, false));
      onSaved();
    } catch (e) {
      setOn(!next);
      setShowError(errText(e));
    }
  }
  async function saveRate() {
    const bad = rateErr(rate);
    if (bad) return setRateError(bad);
    setRateBusy(true);
    setRateError("");
    try {
      await api("vendor/services/update", { method: "PUT", body: { serviceId: x._id, price: +rate } });
      onRateOpen(false);
      setRateSaved(true);
      onSaved();
    } catch (e) {
      setRateError(errText(e)); // the category range, from the server: the editor stays open
    } finally {
      setRateBusy(false);
    }
  }
  const rateKeys = (e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); saveRate(); }
    if (e.key === "Escape") { e.preventDefault(); onRateOpen(false); }
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      await api("vendor/services/update", { method: "PUT", body: { serviceId: x._id, description: edit.desc.trim() } });
      setEdit(null);
      toast("Saved");
      onSaved();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={s.item}>
      <div className={s.itemHead}>
        <div>
          <b>{x.subcategory.serviceName}</b>
          <span className="muted"> · {x.category.categoryName}</span>
          {rateOpen ? (
            <div className={s.rateEdit}>
              <span className={s.money}>
                <b aria-hidden>$</b>
                <input id={rid} className="input" inputMode="numeric" autoComplete="off" maxLength={4} autoFocus value={rate}
                  aria-label={`Hourly rate for ${name}`} aria-invalid={rateError ? true : undefined} aria-describedby={rateError ? `${rid}-err` : undefined}
                  onChange={(e) => { setRate(e.target.value.replace(/\D/g, "")); setRateError(""); }} onKeyDown={rateKeys} />
              </span>
              <span className="muted">/ hr</span>
              <button type="button" className={`btn p ${s.iconBtn}`} onClick={saveRate} disabled={rateBusy} aria-busy={rateBusy} aria-label="Save rate">
                {rateBusy ? <span className="spin" aria-hidden /> : <Check size={16} weight="bold" aria-hidden />}
              </button>
              <button type="button" className={`btn ${s.iconBtn}`} onClick={() => onRateOpen(false)} disabled={rateBusy} aria-label="Cancel, keep the old rate">
                <X size={16} aria-hidden />
              </button>
            </div>
          ) : (
            <div>
              <button type="button" className={`${s.link} ${s.rateBtn}`} onClick={() => onRateOpen(true)} aria-label={`Change the rate for ${name}, now ${money(x.price)} per hour`}>
                {money(x.price)} / hr <PencilSimple size={14} aria-hidden />
              </button>
              {rateSaved && <span className="hint" role="status"> Saved</span>}
            </div>
          )}
          {rateOpen && rateError && <p id={`${rid}-err`} className="err" role="alert">{rateError}</p>}
          {x.description && <p className={s.svcDesc}>{x.description}</p>}
          <label className={s.toggle}>
            <input type="checkbox" role="switch" checked={on} onChange={(e) => show(e.target.checked)} />
            <span className={s.sw} aria-hidden />
            <span><span className="sr">{name}: </span>{on ? "Shown to customers" : "Hidden from customers"}</span>
          </label>
        </div>
        {!edit && (
          <span className={s.buttons}>
            <button type="button" className="btn" onClick={() => setEdit({ desc: x.description ?? "" })}
              aria-label={`Edit the description of ${x.subcategory.serviceName}`}>Edit</button>
            <button type="button" className="btn d" onClick={onRemove} aria-label={`Remove ${x.subcategory.serviceName}`}>Remove</button>
          </span>
        )}
      </div>
      {showError && <ServerError text={showError} />}
      {edit && (
        <form method="post" className={s.stack} onSubmit={save} noValidate>
          <Field id={`desc-${x._id}`} label="Description (optional)">
            <textarea className={`input ${s.short}`} maxLength={1000} value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} />
          </Field>
          {error && <ServerError text={error} />}
          <span className={s.buttons}>
            <button className="btn p" disabled={busy} aria-busy={busy}>Save</button>
            <button type="button" className="btn" onClick={() => { setEdit(null); setError(""); }}>Cancel</button>
          </span>
        </form>
      )}
    </li>
  );
}
