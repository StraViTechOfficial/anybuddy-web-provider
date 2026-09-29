"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { VendorService } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Field, errText, hasErrors, rateError } from "./Field";
import s from "./forms.module.css";

// One service: name, category, rate. Edit opens inline (rate + description); Remove hands off to the Undo toast.
export function ServiceRow({ service: x, onSaved, onRemove }: { service: VendorService; onSaved: () => void; onRemove: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState<{ rate: string; desc: string } | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rid = `rate-${x._id}`;
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
          <div>{money(x.price)}/hr</div>
        </div>
        {!edit && (
          <span className={s.buttons}>
            <button type="button" className="btn" onClick={() => setEdit({ rate: String(Math.round(x.price)), desc: x.description ?? "" })}
              aria-label={`Edit ${x.subcategory.serviceName}`}>Edit</button>
            <button type="button" className="btn d" onClick={onRemove} aria-label={`Remove ${x.subcategory.serviceName}`}>Remove</button>
          </span>
        )}
      </div>
      {edit && (
        <form className={s.stack} onSubmit={save} noValidate>
          <Field id={rid} label="Hourly rate (USD)" error={err}>
            <input inputMode="numeric" maxLength={4} value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} />
          </Field>
          <Field id={`desc-${x._id}`} label="Description" hint="Optional.">
            <textarea className={`input ${s.short}`} maxLength={1000} value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} />
          </Field>
          {error && <p className="err" role="alert">{error}</p>}
          <span className={s.buttons}>
            <button className="btn p" disabled={busy} aria-busy={busy}>Save</button>
            <button type="button" className="btn" onClick={() => { setEdit(null); setTried(false); setError(""); }}>Cancel</button>
          </span>
        </form>
      )}
    </li>
  );
}
