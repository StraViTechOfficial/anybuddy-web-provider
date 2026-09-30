"use client";
import { useState, type ReactNode } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { fileError, upload, type FileKind } from "@/lib/api";
import { errText } from "./Field";
import s from "./forms.module.css";

export type Slot = { url: string; name?: string; local?: string; busy?: boolean; error?: string; retry?: File };

/** File slots for one form (profile photo, documents): check the file, then uploading → done, or the error with Retry. */
export function useUploads<K extends string>(folder: "profile" | "documents", kind: FileKind) {
  const [slots, setSlots] = useState<Partial<Record<K, Slot>>>({});
  const put = (k: K, v: Slot | undefined) => setSlots((d) => ({ ...d, [k]: v }));

  async function pick(k: K, file?: File) {
    if (!file) return;
    const old = slots[k];
    const kept: Slot = { url: old?.url ?? "", name: old?.name, local: old?.local }; // a failed pick keeps the file already there
    const bad = fileError(file, kind);
    if (bad) return put(k, { ...kept, error: bad });
    put(k, { ...kept, name: file.name, busy: true });
    let next: Slot = { ...kept, error: "Upload failed. Try again.", retry: file };
    try {
      next = { url: await upload(file, folder), name: file.name, local: URL.createObjectURL(file) };
    } catch (e) {
      next.error = errText(e);
    } finally {
      put(k, next); // never leaves the slot on "Uploading"
    }
  }

  const busy = Object.values<Slot | undefined>(slots).some((x) => x?.busy);
  return { slots, setSlots, put, pick, busy };
}

/** One slot's status: spinner and file name while sending, a check when done, else `idle`; the error with Retry below. */
export function UploadNote({ slot, id, idle, onRetry }: { slot?: Slot; id: string; idle: ReactNode; onRetry: (f: File) => void }) {
  return (
    <>
      {slot?.busy ? (
        <p className="hint" role="status"><span className="spin" aria-hidden /> Uploading… {slot.name}</p>
      ) : slot?.url ? (
        <p className={s.ok}><CheckCircle size={16} weight="fill" aria-hidden /> {slot.name ?? "Uploaded"}</p>
      ) : idle}
      {slot?.error && !slot.busy && (
        <p id={id} className="err" role="alert">
          {slot.error}{" "}
          {slot.retry && <button type="button" className={s.link} onClick={() => onRetry(slot.retry!)}>Retry</button>}
        </p>
      )}
    </>
  );
}
