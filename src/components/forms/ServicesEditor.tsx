"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, Wrench } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { Category, SubCategory, VendorService } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { useToast } from "@/components/Toast";
import { Actions, Field, RequiredNote, SelectField, errText, hasErrors, rateError, type Errors, type FormProps } from "./Field";
import { RateField } from "./RateField";
import { ServerError, ServiceRow } from "./ServiceRow";
import s from "./forms.module.css";

const FIRST = ["Plumbing", "Electrical"]; // D-30 trades lead the list
const rank = (c: Category) => (FIRST.includes(c.categoryName) ? FIRST.indexOf(c.categoryName) : FIRST.length);

// Screen 2 and Account › Services. Your services first, then one Add button that opens the add panel inline.
// Every change saves at once; onboarding's Continue needs one service.
export function ServicesEditor({ mode, onDone, onBack }: FormProps) {
  const { vendor } = useVendor();
  const toast = useToast();
  const [list, setList] = useState<VendorService[] | null>(null);
  const [gone, setGone] = useState<string[]>([]); // removed, waiting out the Undo window
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState({ cat: "", sub: "", rate: "", desc: "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; needsAddress?: boolean } | null>(null);
  const [nextError, setNextError] = useState("");
  const [ask, setAsk] = useState<{ name: string; note: string; error?: string; busy?: boolean } | null>(null); // FEA-38
  const addBtn = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => { // closing the panel hands focus back to the button that opens it
    if (wasOpen.current && !open) addBtn.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const load = useCallback(() => api<VendorService[]>("vendor/services/list", { query: { page: 1, limit: 100 } })
    .then((r) => { setList(r.data); if (!r.data.length) setOpen(true); }) // nothing yet: the add panel is the next step
    .catch((e) => setError({ text: errText(e) })), []);
  useEffect(() => {
    load();
    api<Category[]>("vendor/services/list-categories").then((r) => setCats([...r.data].sort((a, b) => rank(a) - rank(b)))).catch(() => {});
  }, [load]);
  useEffect(() => { if (vendor?.price && !add.rate) setAdd((a) => ({ ...a, rate: String(Math.round(vendor.price!)) })); }, [vendor?.price, add.rate]);
  useEffect(() => {
    setSubs([]);
    if (add.cat) api<SubCategory[]>("vendor/services/list-subcategories", { query: { categoryId: add.cat } }).then((r) => setSubs(r.data)).catch(() => {});
  }, [add.cat]);

  const shown = (list ?? []).filter((x) => !gone.includes(x._id));
  const added = new Set(shown.map((x) => x.subcategory._id));
  const check = () => ({
    cat: !add.cat ? "Choose a category." : undefined,
    sub: !add.sub ? "Choose a service." : added.has(add.sub) ? "You already offer this service." : undefined,
    addRate: rateError(add.rate),
  });
  const errs: Errors = tried ? check() : {};

  function start() {
    setOpen(true);
    setTimeout(() => document.getElementById("cat")?.focus());
  }
  function close() {
    setOpen(false);
    setTried(false);
    setError(null);
    setAdd((a) => ({ ...a, cat: "", sub: "", desc: "" }));
    setAsk(null);
  }

  // D-50: a service missing from the list goes to support as a request.
  async function request(e: FormEvent) {
    e.preventDefault();
    if (!ask || !vendor) return;
    if (!ask.name.trim()) {
      setAsk({ ...ask, error: "Enter the service name." });
      return document.getElementById("askName")?.focus();
    }
    setAsk({ ...ask, error: undefined, busy: true });
    const category = cats.find((c) => c._id === add.cat)?.categoryName;
    try {
      await api("user/support/send-message", {
        method: "POST",
        body: {
          name: `${vendor.firstName} ${vendor.lastName}`.trim(), email: vendor.email, role: 2,
          description: ["Service request", `Service: ${ask.name.trim()}`, category && `Category: ${category}`, ask.note.trim() && `Note: ${ask.note.trim()}`].filter(Boolean).join("\n"),
        },
      });
      toast("Sent. We'll let you know when it's added.");
      setAsk(null);
    } catch (e) {
      setAsk({ ...ask, error: errText(e), busy: false });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (hasErrors(check())) return;
    setBusy(true);
    try {
      const { data } = await api<{ serviceId: string }>("vendor/services/add", {
        method: "POST", body: { appliedServiceFor: add.sub, categoryId: add.cat, ...(add.desc.trim() && { description: add.desc.trim() }) },
      });
      // Same as iOS: add takes the profile rate, then the service's own rate is set.
      await api("vendor/services/update", { method: "PUT", body: { serviceId: data.serviceId, price: +add.rate, description: add.desc.trim() } })
        .catch(() => toast("Service added, but its rate did not save. Edit it to set the rate."));
      setNextError("");
      toast("Service added.");
      close();
      await load();
    } catch (e) {
      setError({ text: errText(e), needsAddress: /add your address/i.test(errText(e)) });
    } finally {
      setBusy(false);
    }
  }

  function remove(x: VendorService) {
    setGone((g) => [...g, x._id]);
    const timer = setTimeout(() => {
      api("vendor/services/remove", { method: "DELETE", query: { serviceId: x._id } })
        .then(load)
        .catch((e) => { setGone((g) => g.filter((id) => id !== x._id)); toast(errText(e)); });
    }, 5000); // the toast's Undo window
    toast(`${x.subcategory.serviceName} removed.`, () => { clearTimeout(timer); setGone((g) => g.filter((id) => id !== x._id)); });
  }

  function next() {
    if (shown.length) return onDone();
    setNextError("Add at least one service to continue.");
    start();
  }

  return (
    <div className={`${s.form} ${s.narrow}`}>
      <section className={s.stack} aria-labelledby="yours">
        <h2 id="yours">Your services{shown.length > 0 && <span className="muted"> ({shown.length})</span>}</h2>
        {list === null ? <div className="skeleton" style={{ height: 72 }} /> : shown.length === 0 ? (
          <div className={`box ${s.empty}`}>
            <Wrench size={20} aria-hidden />
            <p>No services yet. Add the services you offer so customers can book you.</p>
          </div>
        ) : (
          <ul className={`box ${s.list}`}>
            {shown.map((x) => <ServiceRow key={x._id} service={x} onSaved={load} onRemove={() => remove(x)} />)}
          </ul>
        )}
      </section>

      {!open ? (
        <div><button ref={addBtn} type="button" className="btn lg" onClick={start}><Plus size={20} aria-hidden />Add a service</button></div>
      ) : (
        <div className={`box ${s.addPanel}`}>
          <form method="post" className={s.addPanel} onSubmit={submit} noValidate aria-labelledby="addTitle">
            <h3 id="addTitle">Add a service</h3>
            <RequiredNote />
            <SelectField id="cat" label="Category" required error={errs.cat} placeholder="Choose a category" value={add.cat}
              onChange={(cat) => setAdd({ ...add, cat, sub: "" })} options={cats.map((c) => ({ value: c._id, label: c.categoryName }))} />
            <SelectField id="sub" label="Service" required error={errs.sub} placeholder={add.cat ? "Choose a service" : "Choose a category first"}
              value={add.sub} disabled={!subs.length} onChange={(sub) => setAdd({ ...add, sub })}
              options={subs.map((c) => ({ value: c._id, label: c.serviceName, disabled: added.has(c._id), hint: added.has(c._id) ? "Added" : undefined }))} />
            <RateField id="addRate" value={add.rate} error={errs.addRate} onChange={(rate) => setAdd((a) => ({ ...a, rate }))} />
            <Field id="desc" label="Description (optional)" hint="What is included and the tools you bring.">
              <textarea className={`input ${s.short}`} maxLength={1000} value={add.desc} onChange={(e) => setAdd({ ...add, desc: e.target.value })} />
            </Field>
            {error && (error.needsAddress ? (
              <p className="err" role="alert">
                {error.text}{" "}
                {mode === "edit" ? <Link href="/account/profile">Edit profile</Link> : onBack && <button type="button" className={s.link} onClick={onBack}>Go back to your profile</button>}
              </p>
            ) : <ServerError text={error.text} />)}
            <span className={s.buttons}>
              <button className="btn p lg" disabled={busy} aria-busy={busy}>Add service</button>
              {shown.length > 0 && <button type="button" className="btn lg" onClick={close}>Cancel</button>}
            </span>
          </form>
          {!ask ? (
            <p className="muted">Your service is not in the list.{" "}
              <button type="button" className={s.link} onClick={() => { setAsk({ name: "", note: "" }); setTimeout(() => document.getElementById("askName")?.focus()); }}>Ask us to add it</button>
            </p>
          ) : (
            <form method="post" className={`${s.stack} ${s.ask}`} onSubmit={request} noValidate aria-labelledby="askTitle">
              <h3 id="askTitle">Ask for a new service</h3>
              <Field id="askName" label="Service name" required error={ask.error && !ask.name.trim() ? ask.error : undefined}>
                <input autoComplete="off" maxLength={100} value={ask.name} onChange={(e) => setAsk({ ...ask, name: e.target.value, error: undefined })} />
              </Field>
              <Field id="askNote" label="Note (optional)">
                <textarea className={`input ${s.short}`} maxLength={1000} value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value })} />
              </Field>
              {ask.error && ask.name.trim() && <ServerError text={ask.error} />}
              <span className={s.buttons}>
                <button className="btn p" disabled={ask.busy} aria-busy={ask.busy}>Send request</button>
                <button type="button" className="btn" onClick={() => setAsk(null)}>Cancel</button>
              </span>
            </form>
          )}
        </div>
      )}

      {mode === "onboarding" && (
        <form method="post" onSubmit={(e) => { e.preventDefault(); next(); }}>
          <Actions mode={mode} busy={false} onBack={onBack} error={nextError} />
        </form>
      )}
    </div>
  );
}
