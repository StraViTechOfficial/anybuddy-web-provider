"use client";
import { useEffect, useRef, useState } from "react";
import { Camera } from "@phosphor-icons/react";
import { api, ApiError, upload } from "@/lib/api";
import { useToast } from "@/components/Toast";
import s from "./JobActions.module.css";

type Photo = { url: string; media_type: string };

// The 4-digit start or finish code the customer received. Four full boxes check the code with the server.
export function CodeStep({ bookingId, finish, onDone, onClose }: { bookingId: string; finish: boolean; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [err, setErr] = useState("");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { boxes.current[0]?.focus(); }, []);

  const check = async (code: string) => {
    setBusy(true);
    setErr("");
    try {
      await api("vendor/bookings/set-checkIn-checkOut", {
        method: "PUT",
        body: { bookingId, verificationCode: Number(code), type: finish ? 2 : 1, ...(finish && photos.length ? { checkOutImages: photos } : {}) },
      });
      toast(finish ? "Code accepted. The job is finished." : "Code accepted. The job has started.");
      onDone();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Something went wrong. Try again.");
      setLocked(x instanceof ApiError && x.status === 429);
      setDigits(["", "", "", ""]);
      setBusy(false);
      boxes.current[0]?.focus();
    }
  };

  const set = (next: string[]) => {
    setDigits(next);
    if (next.every(Boolean) && !locked) check(next.join(""));
  };
  const onInput = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    if (d && i < 3) boxes.current[i + 1]?.focus();
    set(next);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4).split("");
    if (!d.length) return;
    e.preventDefault();
    boxes.current[Math.min(d.length, 3)]?.focus();
    set([0, 1, 2, 3].map((i) => d[i] ?? ""));
  };

  const resend = async () => {
    setErr("");
    try {
      await api("vendor/bookings/send-code", { method: "PUT", body: { bookingId } });
      setLocked(false);
      toast("Code sent again to the customer.");
      boxes.current[0]?.focus();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Something went wrong. Try again.");
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setErr("");
    try {
      const list = [...files].slice(0, 20 - photos.length);
      const urls = await Promise.all(list.map((f) => upload(f, "jobs")));
      setPhotos((p) => [...p, ...urls.map((url, i) => ({ url, media_type: list[i].type }))]);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "The upload didn't finish. Try again.");
    }
    setUploading(false);
  };

  return (
    <div className={s.panel}>
      {/* Compact (owner 29 Sep): instruction first, code and resend on one row, photos and close on one row. */}
      <fieldset className={s.codeSet} disabled={busy}>
        <legend>{finish ? "Finish code" : "Start code"}</legend>
        <p className="hint" id="code-hint">The customer has it by text and email.</p>
        <div className={s.codeRow}>
          <div className={s.code} onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { boxes.current[i] = el; }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                aria-label={`Digit ${i + 1}`}
                aria-describedby={i === 0 ? "code-hint" : undefined}
                aria-invalid={!!err}
                value={d}
                onChange={(e) => onInput(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus(); }}
              />
            ))}
          </div>
          <button type="button" className={`btn ${locked ? "p" : ""}`} onClick={resend}>Send again</button>
        </div>
      </fieldset>
      {err && <p className="err" role="alert">{err}</p>}
      <div className={s.codeRow}>
        {finish && (
          <label className="btn" aria-busy={uploading}>
            <Camera size={20} aria-hidden />
            {uploading ? "Uploading" : photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} added, add more` : "Add photos, optional"}
            <input type="file" accept="image/*" multiple className="sr" disabled={uploading || photos.length >= 20} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        <button type="button" className={`btn ${s.close}`} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
