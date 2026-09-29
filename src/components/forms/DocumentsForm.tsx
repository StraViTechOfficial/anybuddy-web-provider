"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, upload } from "@/lib/api";
import type { DocKey, VendorDocs, VendorService } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { Actions, errText, hasErrors, type FormProps } from "./Field";
import s from "./forms.module.css";

type Slot = { url: string; name?: string; local?: string; busy?: boolean; error?: string };
const LICENSED = ["Plumbing", "Electrical"]; // D-30: these trades must send a license
const TYPES = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const DOCS: [DocKey, string, string][] = [
  ["IdProofFront", "Government ID, front", "Add the front of your ID."],
  ["IdProofBack", "Government ID, back", "Add the back of your ID."],
  ["certificate", "License or certificate", "Add your license or certificate."],
  ["additionalDoc", "Other document", ""],
];

// Screen 4 and Account › Documents. Files go to the private "documents" folder; saved ones come back as 10-minute links.
export function DocumentsForm({ mode, onDone, onBack }: FormProps) {
  const { vendor, reload } = useVendor();
  const [docs, setDocs] = useState<Partial<Record<DocKey, Slot>>>({});
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

  const put = (k: DocKey, v: Slot | undefined) => setDocs((d) => ({ ...d, [k]: v }));
  async function pick(k: DocKey, file?: File) {
    if (!file) return;
    const old = docs[k];
    if (file.size > 10 * 1024 * 1024) return put(k, { ...(old ?? { url: "" }), error: "Choose a file under 10 MB." });
    put(k, { url: old?.url ?? "", busy: true });
    try {
      put(k, { url: await upload(file, "documents"), name: file.name, local: URL.createObjectURL(file) });
    } catch (e) {
      put(k, { ...(old ?? { url: "" }), error: errText(e) });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError("");
    if (DOCS.some(([k]) => docs[k]?.busy)) return setError("Wait for the uploads to finish.");
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
    <form onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!loaded}>
      <ul className={s.docs}>
        {DOCS.map(([k, label]) => {
          const d = docs[k];
          const err = d?.error ?? errs[`doc-${k}`];
          const view = d?.local ?? (d?.url || undefined); // fresh upload: the local copy; saved: the signed link
          return (
            <li key={k} className={`box ${s.doc}`}>
              <div>
                <b>{label}</b>
                <p className={d?.url ? s.ok : "hint"}>{d?.busy ? "Uploading" : d?.url ? d.name ?? "Uploaded" : note(k)}</p>
                {err && <p id={`err-${k}`} className="err">{err}</p>}
              </div>
              <span className={s.buttons}>
                {view && !d?.busy && <a className="btn" href={view} target="_blank" rel="noopener noreferrer">View<span className="sr"> {label}</span></a>}
                <label className="btn" aria-busy={d?.busy}>
                  {d?.url ? "Replace" : "Upload"}
                  <input id={`doc-${k}`} className="sr" type="file" accept={TYPES} disabled={d?.busy}
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
      <p className="hint">Photos or PDF files, up to 10 MB each. Only our review team can open them.</p>
      <div className="field">
        <label className={s.check}>
          <input id="tick" type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)}
            aria-invalid={errs.tick ? true : undefined} aria-describedby={errs.tick ? "tick-err" : undefined} />
          I hold the licenses and insurance my trade needs.
        </label>
        {errs.tick && <small id="tick-err" className="err">{errs.tick}</small>}
      </div>
      {mode === "edit" && vendor?.verificationStatus === 1 && (
        <p className={`${s.note} t-wait`}>Saving changed documents sends your account back to review. Customers can&apos;t book you until it&apos;s approved again.</p>
      )}
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} />
      </fieldset>
    </form>
  );
}
