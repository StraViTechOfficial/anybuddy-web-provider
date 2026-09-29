"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { VendorService } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Field, RequiredNote, errText, hasErrors, rateError } from "./Field";
import { RateField } from "./RateField";
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
// Edit opens inline (rate + description); Remove and Hide hand off to the Undo toast.
export function ServiceRow({ service: x, onSaved, onRemove }: { service: VendorService; onSaved: () => void; onRemove: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState<{ rate: string; desc: string } | null>(null);
  const [tried, setTried] = useState(false);
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
  const err = tried && edit ? rateError(edit.rate) : undefined;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setTried(true);
    if (hasErrors({ [rid]: rateError(edit.rate) })) return;
    setBusy(true);
    setError("");
    try {
      await api("vendor/services/update", { method: "PUT", body: { serviceId: x._id, price: +edit.rate, description: edit.desc.trim() } });
      setEdit(null);
      setTried(false);
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
          <div>{money(x.price)} / hr</div>
          {x.description && <p className={s.svcDesc}>{x.description}</p>}
          <label className={s.toggle}>
            <input type="checkbox" role="switch" checked={on} onChange={(e) => show(e.target.checked)} />
            <span className={s.sw} aria-hidden />
            <span><span className="sr">{name}: </span>{on ? "Shown to customers" : "Hidden from customers"}</span>
          </label>
        </div>
        {!edit && (
          <span className={s.buttons}>
            <button type="button" className="btn" onClick={() => setEdit({ rate: String(Math.round(x.price)), desc: x.description ?? "" })}
              aria-label={`Edit ${x.subcategory.serviceName}`}>Edit</button>
            <button type="button" className="btn d" onClick={onRemove} aria-label={`Remove ${x.subcategory.serviceName}`}>Remove</button>
          </span>
        )}
      </div>
      {showError && <ServerError text={showError} />}
      {edit && (
        <form method="post" className={s.stack} onSubmit={save} noValidate>
          <RequiredNote />
          <RateField id={rid} value={edit.rate} error={err} onChange={(rate) => setEdit((o) => o && { ...o, rate })} />
          <Field id={`desc-${x._id}`} label="Description (optional)">
            <textarea className={`input ${s.short}`} maxLength={1000} value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} />
          </Field>
          {error && <ServerError text={error} />}
          <span className={s.buttons}>
            <button className="btn p" disabled={busy} aria-busy={busy}>Save</button>
            <button type="button" className="btn" onClick={() => { setEdit(null); setTried(false); setError(""); }}>Cancel</button>
          </span>
        </form>
      )}
    </li>
  );
}
