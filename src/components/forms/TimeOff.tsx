"use client";
import { useState, type KeyboardEvent } from "react";
import { day, dayKey } from "@/lib/format";
import type { Leave } from "@/lib/types";
import { DatePicker } from "@/components/ui/DatePicker";
import s from "./forms.module.css";

// Days off inside the hours form (saved with it). Dates are business days "YYYY-MM-DD"; past ones are dropped.

export function TimeOff({ leaves, onChange }: { leaves: Leave[]; onChange: (l: Leave[]) => void }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const min = dayKey();
  const shown = leaves.filter((l) => l.date >= min).sort((a, b) => a.date.localeCompare(b.date));

  function add() {
    if (!date || date < min) return setError("Choose today or a later date.");
    if (leaves.some((l) => l.date === date)) return setError("That day is already off.");
    onChange([...shown, { date, description: note.trim() }]);
    setDate("");
    setNote("");
    setError("");
  }
  const enter = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); add(); } };

  return (
    <>
      {shown.map((l) => (
        <div key={l.date} className={s.day}>
          <span><b>{day(`${l.date}T12:00:00Z`)}</b> {l.description && <span className="muted">{l.description}</span>}</span>
          <button type="button" className="btn" onClick={() => onChange(shown.filter((x) => x.date !== l.date))}
            aria-label={`Remove time off on ${day(`${l.date}T12:00:00Z`)}`}>Remove</button>
        </div>
      ))}
      <div className={s.addoff}>
          <DatePicker id="dayOff" label="Day off" hideLabel min={min} value={date} onChange={(v) => { setDate(v); setError(""); }}
            invalid={!!error} describedBy={error ? "offErr" : undefined} />
          <input className="input" value={note} maxLength={100} placeholder="Note (optional)" aria-label="Note" onChange={(e) => setNote(e.target.value)} onKeyDown={enter} />
        <button type="button" className="btn" onClick={add}>Add time off</button>
        {error && <small id="offErr" className={`err ${s.full}`}>{error}</small>}
      </div>
    </>
  );
}
