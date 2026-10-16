"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Eye, File as FileIcon, FilePdf } from "@phosphor-icons/react";
import { api, FILES, fileRule, upload } from "@/lib/api";
import type { LicenceItem, Onboarding, VendorDocs, VendorProfile } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { Actions, errText, hasErrors, type FormProps } from "./Field";
import { UploadNote, useUploads, type Slot } from "./Upload";
import { SelfieSheet } from "./Selfie";
import { DocPreview } from "./DocPreview";
import c from "@/components/Checklist.module.css";
import s from "./forms.module.css";

const ID: ["IdProofFront" | "IdProofBack" | "selfieDoc", string, string][] = [
  ["IdProofFront", "ID front", "Add the front of your ID."],
  ["IdProofBack", "ID back", "Add the back of your ID."],
  ["selfieDoc", "Selfie", "Take a selfie."], // taken with the live camera only and saved like the ID photos; required only before sending for verification
];
const STATUS: Record<LicenceItem["status"], [string, string]> = {
  missing: ["", ""], pending: ["In review", "t-wait"], approved: ["Approved", "t-ok"], needs_changes: ["Needs changes", "t-bad"],
};
const licenceName = (l: LicenceItem) => l.licenceName || `${l.categoryName} license`;

// Step 3 of 3 and Account › Documents. It asks for the government ID, front and back, and a licence row only for each
// licensed category the Buddy offers (an admin switch decides which categories need one). Licences can be added later,
// and those services stay hidden until approved. The website has no document scanner, so documents are photo or PDF
// uploads, and the selfie comes from the front camera only. Files go to the private "documents" folder.
export function DocumentsForm({ mode, onDone, onBack }: FormProps) {
  const { vendor, reload } = useVendor();
  const { slots, setSlots, pick, busy: uploading } = useUploads<string>("documents", "document");
  const [saved, setSaved] = useState<VendorDocs>({}); // what the server has, sent back unchanged (old rows included)
  const [licences, setLicences] = useState<LicenceItem[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false); // inputs stay disabled until the saved values are in
  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState<{ src: string; name: string; pdf: boolean } | null>(null);
  // Uploads must not be lost when the Buddy leaves. Before approval, each upload saves at once. After approval, a new ID
  // sends the account back to review, so files save only on Submit, and leaving with unsaved files asks Save or Discard.
  const approved = vendor?.verificationStatus === 1;
  const [stored, setStored] = useState<Record<string, string>>({}); // maps each slot key to the URL the server has from this visit
  const [leaving, setLeaving] = useState(""); // the in-app link the Buddy clicked with unsaved files
  const router = useRouter();
  const [asPhoto, setAsPhoto] = useState<File | null>(null); // the selfie, also to be the public profile photo
  const [selfieNeeded, setSelfieNeeded] = useState(false); // new sign-ups only; sent or approved Buddies may skip it

  useEffect(() => {
    Promise.all([
      api<VendorDocs>("vendor/auth/get-profile-details", { query: { type: 3 } }),
      api<Onboarding>("vendor/auth/onboarding"),
    ])
      .then(([{ data }, { data: o }]) => {
        setSaved(data ?? {});
        setSlots(Object.fromEntries(ID.flatMap(([k]) => (data?.[k] ? [[k, { url: data[k]! }]] : []))));
        setLicences(o.checklist?.licences ?? []);
        setSelfieNeeded(o.verify ? !o.verify.submitted : o.stage !== "submitted");
      })
      .then(() => setLoaded(true))
      .catch((e) => setError(errText(e)));
  }, [setSlots]);

  const fresh = (k: string) => !!slots[k]?.local; // picked on this visit
  const keys = [...ID.map(([k]) => k as string), ...licences.map((l) => `lic-${l.categoryId}`)];
  const unsaved = keys.some((k) => fresh(k) && slots[k]?.url && stored[k] !== slots[k]!.url);
  const dirty = approved && unsaved;
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const click = (e: MouseEvent) => { // uses the capture phase, so this runs before Next's Link navigates
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== location.origin || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaving(a.pathname + a.search);
    };
    addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);

  // Before approval, save the one file just uploaded. Only fields with a URL are sent to step 3.
  async function pickSave(k: string, f?: File) {
    const r = await pick(k, f);
    if (!r?.url || r.error || approved) return;
    try {
      if (k.startsWith("lic-")) await api("vendor/auth/licence", { method: "PUT", body: { categoryId: k.slice(4), licenceUrl: r.url } });
      else await api("vendor/auth/update-register-profile", { method: "POST", body: { step: 3, [k]: r.url } });
      setStored((m) => ({ ...m, [k]: r.url }));
    } catch (e) {
      setError(errText(e));
    }
  }
  const check = () => Object.fromEntries(ID.map(([k, , missing]) => [`doc-${k}`, !slots[k]?.url && (k !== "selfieDoc" || selfieNeeded) ? missing : undefined]));
  const errs: Record<string, string | undefined> = tried ? check() : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await save()) onDone();
  }
  async function save() {
    setTried(true);
    setError("");
    if (hasErrors(check())) return false;
    setBusy(true);
    try {
      if (asPhoto && slots.selfieDoc?.local) await saveProfilePhoto(asPhoto); // first, so a failure leaves nothing half-saved
      if (mode === "onboarding" || ID.some(([k]) => fresh(k))) {
        await api("vendor/auth/update-register-profile", {
          method: "POST",
          body: { step: 3, certificate: saved.certificate ?? "", additionalDoc: saved.additionalDoc ?? "", ...Object.fromEntries(ID.map(([k]) => [k, slots[k]?.url ?? ""])) },
        });
      }
      for (const l of licences) {
        if (fresh(`lic-${l.categoryId}`)) await api("vendor/auth/licence", { method: "PUT", body: { categoryId: l.categoryId, licenceUrl: slots[`lic-${l.categoryId}`]!.url } });
      }
      setStored(Object.fromEntries(keys.flatMap((k) => (slots[k]?.url ? [[k, slots[k]!.url]] : []))));
      if (mode === "edit" || asPhoto) await reload().catch(() => {}); // in onboarding the Submitted screen comes next, with no reload
      return true;
    } catch (e) {
      setError(errText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const row = (k: string, label: string, note: React.ReactNode, required: boolean, tag?: React.ReactNode, selfie = false) => {
    const d: Slot | undefined = slots[k];
    const missing = !d?.error && errs[`doc-${k}`];
    const err = d?.error ?? missing;
    const view = d?.local ?? (d?.url || undefined); // a fresh upload uses the local copy, and a saved file uses the signed link
    // Private files return 403 without a signed link, so a fresh pick shows its local copy until the page reloads the
    // signed links.
    // The tile's icon shows through for a PDF, or an image the browser can't draw (HEIC outside Safari).
    const pdf = /\.pdf(\?|$)/i.test(d?.url ?? "");
    return (
      <li key={k} className={`box ${s.doc}`} aria-busy={d?.busy || undefined}>
        {view && !d?.busy && (
          <span className={s.docThumb}>
            {pdf ? <FilePdf size={26} aria-hidden /> : <FileIcon size={26} aria-hidden />}
            {!pdf && <img src={view} alt="" onError={(e) => { e.currentTarget.hidden = true; }} />}
            <button type="button" className={s.eye} aria-label={`View ${label}`} onClick={() => setPreview({ src: view, name: label, pdf })}>
              <Eye size={16} weight="bold" aria-hidden />
            </button>
          </span>
        )}
        <div>
          {/* A Required / Optional tag on every row, as in the apps (no asterisk). */}
          <b>{label}</b> <span className={`tag ${required ? "t-info" : "t-mute"}`}>{required ? "Required" : "Optional"}</span> {tag}
          <UploadNote slot={d} id={`err-${k}`} idle={note} onRetry={(f) => pickSave(k, f)} />
          {!approved && d?.local && d.url && stored[k] === d.url && <p className="hint" role="status">Saved</p>}
          {!selfie && <p className="hint">{fileRule("document")}</p>}
          {missing && <p id={`err-${k}`} className="err">{missing}</p>}
        </div>
        <span className={s.buttons}>
          {selfie ? (
            <button type="button" id={`doc-${k}`} className="btn" onClick={() => setCamera(true)} disabled={d?.busy}
              aria-invalid={err ? true : undefined} aria-describedby={err ? `err-${k}` : undefined}>
              <Camera size={18} aria-hidden /> {d?.url ? "Retake" : "Take a selfie"}
            </button>
          ) : (
          <label className="btn">
            {d?.url ? "Replace" : "Upload"}
            <input id={`doc-${k}`} className="sr" type="file" accept={FILES.document.accept} disabled={d?.busy} aria-required={required || undefined}
              aria-invalid={err ? true : undefined} aria-describedby={err ? `err-${k}` : undefined}
              onChange={(e) => { pickSave(k, e.target.files?.[0]); e.target.value = ""; }} />
            <span className="sr"> {label}</span>
          </label>
          )}
        </span>
      </li>
    );
  };

  return (
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!loaded}>
        <p className="hint">Driver&apos;s license, state ID or passport.</p>
        <ul className={s.docs}>
          {ID.map(([k, label]) => k === "selfieDoc"
            ? row(k, label, <p className="hint">We match your face to your ID.</p>, selfieNeeded, undefined, true)
            : row(k, label, null, true))}
          {licences.map((l) => {
            const [word, tag] = STATUS[l.status];
            const note = l.status === "needs_changes" ? <p className="err">Needs changes{l.note ? `: ${l.note}` : "."} Upload it again.</p>
              : l.status === "missing" ? <p className="hint">License number and expiry must be readable. Or add it later: your {l.categoryName} services stay hidden from customers until it&apos;s approved.</p>
              : null;
            return row(`lic-${l.categoryId}`, licenceName(l), note, false,
              word ? <span className={`tag ${tag}`}>{word}</span> : undefined);
          })}
        </ul>
        <p className="hint">Only our review team can open these files.</p>
        {mode === "edit" && vendor?.verificationStatus === 1 && (
          <p className={`${s.note} t-wait`}>A new ID photo sends your account back to review. Customers cannot book you until it is approved again.</p>
        )}
        <Actions mode={mode} busy={busy} onBack={onBack} error={error} label={mode === "onboarding" ? "Submit" : undefined}
          wait={uploading ? "Wait for the upload to finish." : undefined} />
      </fieldset>
      {leaving && <LeaveDialog busy={busy} onClose={() => setLeaving("")} onDiscard={() => router.push(leaving)}
        onSave={async () => { if (await save()) router.push(leaving); else setLeaving(""); }} />}
      {preview && <DocPreview {...preview} onClose={() => setPreview(null)} />}
      {camera && <SelfieSheet hasPhoto={!!vendor?.logoUrl} onUse={(f, p) => { pickSave("selfieDoc", f); setAsPhoto(p ? f : null); }} onClose={() => setCamera(false)} />}
    </form>
  );
}

/** Uses the selfie as the profile photo, with the same public upload and step 1 save as Profile (ProfileForm). The
 *  rest of the profile is sent back as saved. Step 1 also writes the map point, so this waits until the address has one. */
async function saveProfilePhoto(file: File) {
  const { data: p } = await api<VendorProfile>("vendor/auth/get-profile-details", { query: { type: 1 } });
  if (p.lat == null || p.long == null) return; // ponytail: with no address point yet, the photo is skipped. The Buddy can add it later in Profile.
  const logoUrl = await upload(file, "profile");
  await api("vendor/auth/update-register-profile", {
    method: "POST",
    body: {
      step: 1, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname ?? "", logoUrl,
      address: { street: p.address?.street, city: p.address?.city, state: p.address?.state, country: p.address?.country ?? "United States" },
      postalCode: p.postalCode, latitude: p.lat, longitude: p.long, ...(p.description && { description: p.description }),
    },
  });
}

/** Shown when an approved Buddy leaves Documents with files not sent yet. Save sends them, Discard leaves without them,
 *  and Esc stays on the page. */
function LeaveDialog({ busy, onSave, onDiscard, onClose }: { busy: boolean; onSave: () => void; onDiscard: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className={c.sheet} aria-labelledby="leave-t" onClose={onClose}>
      <div className={c.stack}>
        <h2 id="leave-t">Unsaved documents</h2>
        <p>Your new files aren&apos;t saved yet. Save sends them for review.</p>
        <span className={s.buttons}>
          <button type="button" className="btn p lg" onClick={onSave} disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="btn lg" onClick={onDiscard} disabled={busy}>Discard</button>
        </span>
      </div>
    </dialog>
  );
}
