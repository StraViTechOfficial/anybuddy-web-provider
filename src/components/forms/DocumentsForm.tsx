"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, FILES, fileRule } from "@/lib/api";
import type { DocKey, VendorDocs, VendorService } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { Actions, Req, RequiredNote, errText, hasErrors, type FormProps } from "./Field";
import { UploadNote, useUploads } from "./Upload";
import s from "./forms.module.css";

const LICENSED = ["Plumbing", "Electrical"]; // D-30: these trades must send a license
const DOCS: [DocKey, string, string][] = [
  ["IdProofFront", "Government ID, front", "Add the front of your ID."],
  ["IdProofBack", "Government ID, back", "Add the back of your ID."],
  ["certificate", "License or certificate", "Add your license or certificate."],
  ["additionalDoc", "Other document", ""],
];

// Screen 4 and Account › Documents. Files go to the private "documents" folder; saved ones come back as 10-minute links.
export function DocumentsForm({ mode, onDone, onBack }: FormProps) {
  const { vendor, reload } = useVendor();
  const { slots: docs, setSlots: setDocs, put, pick, busy: uploading } = useUploads<DocKey>("documents", "document");
  const [trades, setTrades] = useState<string[]>([]);
  const [tick, setTick] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false); // inputs stay disabled until the saved values are in

  useEffect(() => {
    api<VendorDocs>("vendor/auth/get-profile-details", { query: { type: 3 } })
      .then(({ data }) => setDocs(Object.fromEntries(DOCS.flatMap(([k]) => (data?.[k] ? [[k, { url: data[k]! }]] : [])))))
      .then(() => setLoaded(true))
      .catch((e) => setError(errText(e)));
    api<VendorService[]>("vendor/services/list", { query: { page: 1, limit: 100 } })
      .then((r) => setTrades([...new Set(r.data.map((x) => x.category.categoryName).filter((c) => LICENSED.includes(c)))]))
      .catch(() => {});
  }, []);

  const needsLicense = trades.length > 0;
  const required = (k: DocKey) => k === "IdProofFront" || k === "IdProofBack" || (k === "certificate" && needsLicense);
  const note = (k: DocKey) => (required(k) ? (k === "certificate" ? `Required for ${trades.join(" and ")}` : "Required")
    : k === "certificate" ? "Optional. For skilled trades." : "Optional");

  const check = () => ({
    ...Object.fromEntries(DOCS.map(([k, , missing]) => [`doc-${k}`, required(k) && !docs[k]?.url ? missing : undefined])),
    tick: !tick ? "Confirm that you hold the licenses and insurance your trade needs." : undefined,
  });
  const errs: Record<string, string | undefined> = tried ? check() : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError("");
    if (hasErrors(check())) return;
    setBusy(true);
    try {
      await api("vendor/auth/update-register-profile", {
        method: "POST",
        body: { step: 3, ...Object.fromEntries(DOCS.map(([k]) => [k, docs[k]?.url ?? ""])) },
      });
      await reload().catch(() => {});
      onDone();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!loaded}>
      <RequiredNote />
      <ul className={s.docs}>
        {DOCS.map(([k, label]) => {
          const d = docs[k];
          const err = d?.error ?? errs[`doc-${k}`];
          const missing = !d?.error && errs[`doc-${k}`];
          const view = d?.local ?? (d?.url || undefined); // fresh upload: the local copy; saved: the signed link
          return (
            <li key={k} className={`box ${s.doc}`} aria-busy={d?.busy || undefined}>
              <div>
                <b>{label}{required(k) && <Req />}</b>
                <UploadNote slot={d} id={`err-${k}`} idle={<p className="hint">{note(k)}</p>} onRetry={(f) => pick(k, f)} />
                <p className="hint">{fileRule("document")}</p>
                {missing && <p id={`err-${k}`} className="err">{missing}</p>}
              </div>
              <span className={s.buttons}>
                {view && !d?.busy && <a className="btn" href={view} target="_blank" rel="noopener noreferrer">View<span className="sr"> {label}</span></a>}
                <label className="btn">
                  {d?.url ? "Replace" : "Upload"}
                  <input id={`doc-${k}`} className="sr" type="file" accept={FILES.document.accept} disabled={d?.busy} aria-required={required(k) || undefined}
                    aria-invalid={err ? true : undefined} aria-describedby={err ? `err-${k}` : undefined}
                    onChange={(e) => { pick(k, e.target.files?.[0]); e.target.value = ""; }} />
                  <span className="sr"> {label}</span>
                </label>
                {d?.url && !required(k) && !d.busy && (
                  <button type="button" className="btn d" onClick={() => put(k, undefined)}>Remove<span className="sr"> {label}</span></button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="hint">Only our review team can open these files.</p>
      <div className="field">
        <label className={s.check}>
          <input id="tick" type="checkbox" required checked={tick} onChange={(e) => setTick(e.target.checked)}
            aria-invalid={errs.tick ? true : undefined} aria-describedby={errs.tick ? "tick-err" : undefined} />
          <span>I hold the licenses and insurance my trade needs.<Req /></span>
        </label>
        {errs.tick && <small id="tick-err" className="err">{errs.tick}</small>}
      </div>
      {mode === "edit" && vendor?.verificationStatus === 1 && (
        <p className={`${s.note} t-wait`}>Saving changed documents sends your account back to review. Customers cannot book you until it is approved again.</p>
      )}
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} wait={uploading ? "Wait for the upload to finish." : undefined} />
      </fieldset>
    </form>
  );
}
