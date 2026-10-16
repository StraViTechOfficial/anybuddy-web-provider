"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import c from "@/components/Checklist.module.css";
import s from "./forms.module.css";

/** A full-screen preview of one uploaded document. An image fits the screen (click to zoom), and a PDF fills it with
 *  an "Open in a new tab" link. Esc (native <dialog>) or ✕ closes it. `src` is the local copy after an upload, or else
 *  the signed link. */
export function DocPreview({ src, name, pdf, onClose }: { src: string; name: string; pdf: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className={s.preview} aria-label={name} onClose={onClose}>
      <div className={c.sheetHead}>
        <h2>{name}</h2>
        <span className={s.buttons}>
          {pdf && <a className={s.link} href={src} target="_blank" rel="noopener noreferrer">Open in a new tab</a>}
          <button type="button" className={c.x} onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
        </span>
      </div>
      <div className={`${s.previewBody} ${zoom ? s.zoomed : ""}`}>
        {pdf ? <iframe src={src} title={name} />
          : <img src={src} alt={name} onClick={() => setZoom(!zoom)} style={{ cursor: zoom ? "zoom-out" : "zoom-in" }} />}
      </div>
    </dialog>
  );
}
