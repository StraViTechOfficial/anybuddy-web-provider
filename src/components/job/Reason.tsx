"use client";
import { useEffect, useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import s from "./JobActions.module.css";

// Reason picker for declining a request or cancelling a job: the backend's provider reasons plus a note.
export function Reason({ intro, confirm, onSubmit, onClose }: {
  intro?: React.ReactNode;
  confirm: string;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [reasons, setReasons] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ reasons?: string[] } | null>("user/booking/list-cancellation-reasons", { query: { type: 2 } })
      .then((r) => setReasons(r.data?.reasons ?? []))
      .catch(() => {});
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = [pick, note.trim()].filter(Boolean).join(". ");
    if (!reason) {
      setErr("Choose a reason or write one.");
      document.getElementById(reasons.length ? `${id}r` : `${id}n`)?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSubmit(reason);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <form className={s.panel} onSubmit={send} noValidate>
      {intro}
      {reasons.length > 0 && (
        <label className="field">
          <span>Reason</span>
          <select id={`${id}r`} className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-invalid={!!err && !pick && !note}>
            <option value="">Choose a reason</option>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span>{reasons.length ? "Note to the customer (optional)" : "Reason"}</span>
        <textarea id={`${id}n`} className="input" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <div className={s.row}>
        <button className="btn d lg" aria-busy={busy} disabled={busy}>{confirm}</button>
        <button type="button" className="btn lg" onClick={onClose}>Close</button>
      </div>
    </form>
  );
}
