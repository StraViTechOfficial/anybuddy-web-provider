"use client";
import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import c from "@/components/Checklist.module.css";
import s from "./forms.module.css";

// The browser's face detection (Chrome on Android and macOS); missing elsewhere, then the shutter opens once the camera is live.
type Detector = { detect(src: HTMLVideoElement): Promise<{ boundingBox: DOMRectReadOnly }[]> };
type DetectorClass = new (o: { fastMode?: boolean; maxDetectedFaces?: number }) => Detector;
// The face-shaped oval (3:4) as shares of the square the camera shows, a little above the middle (CSS .selfieRing matches).
const OVAL_W = 0.42, OVAL_H = 0.56, OVAL_UP = 0.08; // owner: small enough that head, shoulders and a bit above are in the photo
const SIDE = 960; // the saved photo, square, in pixels
// Owner: the low-light warning, as in the apps. Mean luma (0-255) inside the oval; dark below DARK, light again above
// LIGHT (hysteresis, so it doesn't flicker at the edge). Tune both here; a normal room sits well above 60.
const DARK = 60, LIGHT = 75, PROBE = 32; // PROBE: the small canvas side the luma is read from

/** Mean luma (Rec. 601) inside the oval of the centred square of `src` (w x h), read from a PROBE x PROBE canvas. */
function ovalLuma(src: CanvasImageSource, w: number, h: number, cv: HTMLCanvasElement) {
  const side = Math.min(w, h);
  cv.width = cv.height = PROBE;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, PROBE, PROBE);
  const px = g.getImageData(0, 0, PROBE, PROBE).data;
  const rx = OVAL_W / 2, ry = OVAL_H / 2, cy = 0.5 - OVAL_UP;
  let sum = 0, n = 0;
  for (let y = 0; y < PROBE; y++) for (let x = 0; x < PROBE; x++) {
    const nx = ((x + 0.5) / PROBE - 0.5) / rx, ny = ((y + 0.5) / PROBE - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const i = (y * PROBE + x) * 4;
    sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    n++;
  }
  return n ? sum / n : 255;
}

/** One face inside the oval: the camera fills a centred square (object-fit: cover), the oval sits in it (CSS .selfieRing). */
function inOval({ x, y, width, height }: DOMRectReadOnly, v: HTMLVideoElement) {
  const side = Math.min(v.videoWidth, v.videoHeight);
  const rx = (side * OVAL_W) / 2, ry = (side * OVAL_H) / 2;
  const cx = v.videoWidth / 2, cy = v.videoHeight / 2 - side * OVAL_UP;
  const nx = (x + width / 2 - cx) / rx, ny = (y + height / 2 - cy) / ry;
  return Math.hypot(nx, ny) < 0.35 && width < rx * 2 && width > rx * 0.6;
}

/** R13 live selfie: front camera in a sheet with a face oval, the shutter, then Retake / Use photo. No file upload: a
 *  camera that is off or missing gets a message to allow it or use the Any-Buddy Pro app. */
// Owner: the preview offers "Also use this as my profile photo", ticked unless the Buddy already has a profile photo.
export function SelfieSheet({ onUse, onClose, hasPhoto }: { onUse: (f: File, asPhoto: boolean) => void; onClose: () => void; hasPhoto: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [detect, setDetect] = useState(false); // the browser can find faces
  const [face, setFace] = useState(false); // one face inside the oval
  const [shot, setShot] = useState<{ file: File; url: string; dark: boolean } | null>(null);
  const [dark, setDark] = useState(false); // live: the oval is too dark (shows a warning only; the shutter never waits)
  const [attempt, setAttempt] = useState(0);
  const [asPhoto, setAsPhoto] = useState(!hasPhoto);
  useEffect(() => { ref.current?.showModal(); }, []);

  useEffect(() => {
    if (shot) return; // the camera is off while the photo is shown
    let gone = false, stream: MediaStream | undefined, timer: ReturnType<typeof setInterval> | undefined, light: ReturnType<typeof setInterval> | undefined;
    setLive(false); setBlocked(false); setFace(false); setDark(false);
    if (!navigator.mediaDevices?.getUserMedia) return void setBlocked(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(async (st) => {
        stream = st;
        const v = video.current;
        if (gone || !v) return st.getTracks().forEach((t) => t.stop());
        v.srcObject = st;
        await v.play();
        if (gone) return;
        setLive(true);
        const probe = document.createElement("canvas");
        light = setInterval(() => {
          if (!v.videoWidth) return;
          const l = ovalLuma(v, v.videoWidth, v.videoHeight, probe);
          setDark((was) => (was ? l < LIGHT : l < DARK));
        }, 300);
        const FD = (window as unknown as { FaceDetector?: DetectorClass }).FaceDetector;
        if (!FD) return;
        const fd = new FD({ fastMode: true, maxDetectedFaces: 2 });
        setDetect(true);
        timer = setInterval(() => {
          fd.detect(v).then((f) => !gone && setFace(f.length === 1 && inOval(f[0].boundingBox, v)))
            .catch(() => { clearInterval(timer); if (!gone) setDetect(false); }); // detector broke: fall back to no check
        }, 300);
      })
      .catch(() => !gone && setBlocked(true));
    return () => { gone = true; clearInterval(timer); clearInterval(light); stream?.getTracks().forEach((t) => t.stop()); };
  }, [shot, attempt]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  function take() {
    const v = video.current;
    if (!v) return;
    const side = Math.min(v.videoWidth, v.videoHeight), out = Math.min(side, SIDE);
    const cv = document.createElement("canvas");
    cv.width = cv.height = out;
    cv.getContext("2d")!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, out, out);
    const isDark = ovalLuma(cv, out, out, document.createElement("canvas")) < DARK;
    cv.toBlob((b) => b && setShot({ file: new File([b], "selfie.jpg", { type: "image/jpeg" }), url: URL.createObjectURL(b), dark: isDark }), "image/jpeg", 0.9);
  }

  const ready = live && detect && face; // shows state only; owner: the shutter never waits for it
  return (
    <dialog ref={ref} className={c.sheet} aria-labelledby="selfie-t" onClose={onClose}>
      <div className={c.sheetHead}>
        <h2 id="selfie-t">Take a selfie</h2>
        <button type="button" className={c.x} onClick={onClose} aria-label="Close"><X size={20} aria-hidden /></button>
      </div>
      {blocked ? (
        <div className={c.stack}>
          <p className="err" role="alert">We can&apos;t open your camera. Allow camera access for this site in your browser settings, then try again. Or take your selfie in the Any-Buddy Pro app.</p>
          <button type="button" className="btn p lg block" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : shot ? (
        <div className={c.stack}>
          <img className={s.selfieView} src={shot.url} alt="Your selfie" />
          {shot.dark && <p className={`${s.note} t-wait`} role="alert">This photo is dark. Retake in a brighter spot.</p>}
          <label className={s.check}><input type="checkbox" checked={asPhoto} onChange={(e) => setAsPhoto(e.target.checked)} /> Also use this as my profile photo</label>
          <span className={s.buttons}>
            <button type="button" className={`btn lg ${shot.dark ? "p" : ""}`} onClick={() => setShot(null)}>Retake</button>
            <button type="button" className={`btn lg ${shot.dark ? "" : "p"}`} onClick={() => { onUse(shot.file, asPhoto); onClose(); }}>Use photo</button>
          </span>
        </div>
      ) : (
        <div className={c.stack}>
          <div className={s.selfieView}>
            <video ref={video} playsInline muted aria-label="Front camera" />
            <span className={`${s.selfieRing} ${dark ? s.selfieDark : ready ? s.selfieOk : ""}`} aria-hidden />
          </div>
          <p className="hint" role="status">{!live ? <><span className="spin" aria-hidden /> Opening your camera…</> : dark ? "Too dark. Move to a brighter spot." : ready ? "Hold still." : "Center your face in the oval."}</p>
          <button type="button" className="btn p lg block" onClick={take} disabled={!live}>Take photo</button>
        </div>
      )}
    </dialog>
  );
}
