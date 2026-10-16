"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CaretDown, Wrench } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { Category, ServiceRequest, SubCategory, VendorService } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Actions, Field, SelectField, errText, hasErrors, rateError, type Errors, type FormProps } from "./Field";
import { RateField } from "./RateField";
import { ServiceSearch } from "./ServiceSearch";
import { ServerError, ServiceRow } from "./ServiceRow";
import s from "./forms.module.css";

const ASKED: Record<ServiceRequest["status"], [string, string]> = {
  pending: ["In review", "t-wait"], declined: ["Not added", "t-bad"],
};
const OTHER = "other"; // the category select's "Not in the list"
const FIRST = ["Plumbing", "Electrical"]; // these trades lead the list
const rank = (c: Category) => (FIRST.includes(c.categoryName) ? FIRST.indexOf(c.categoryName) : FIRST.length);
type Range = { rateMin?: number | null; rateMax?: number | null } | undefined;
// v2: the admin's hourly range per category. The rate starts in the middle; the server refuses one outside it.
const mid = (r: Range) => {
  const lo = r?.rateMin ?? null, hi = r?.rateMax ?? null;
  return lo != null && hi != null ? String(Math.round((lo + hi) / 2)) : lo != null ? String(lo) : hi != null ? String(hi) : "";
};
const rangeError = (rate: string, r: Range) => {
  const lo = r?.rateMin ?? null, hi = r?.rateMax ?? null, n = +rate;
  if ((lo != null && n < lo) || (hi != null && n > hi)) return lo != null && hi != null ? `Set a rate between $${lo} and $${hi} per hour.` : lo != null ? `Set a rate of $${lo} per hour or more.` : `Set a rate of $${hi} per hour or less.`;
};

// Onboarding's services step and Account › Services. Your services first, then one Add button that opens the add panel inline.
// Every change saves at once; onboarding's Continue needs one service.
export function ServicesEditor({ mode, onDone, onBack }: FormProps) {
  const toast = useToast();
  const [list, setList] = useState<VendorService[] | null>(null);
  const [gone, setGone] = useState<string[]>([]); // removed, waiting out the Undo window
  const [cats, setCats] = useState<Category[]>([]);
  const [subsBy, setSubsBy] = useState<Record<string, SubCategory[]>>({}); // each category's services, for the counts
  const [openCat, setOpenCat] = useState(""); // the expanded category row
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState({ cat: "", sub: "", rate: "", desc: "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; needsAddress?: boolean } | null>(null);
  const [nextError, setNextError] = useState("");
  // A service missing from the list is requested (POST vendor/services/request), reviewed by admin.
  const [ask, setAsk] = useState<{ name: string; cat: string; rate: string; tried?: boolean; error?: string; busy?: boolean; existing?: string } | null>(null);
  const [asked, setAsked] = useState<ServiceRequest[]>([]);
  const addBtn = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState("");
  const [rateRow, setRateRow] = useState(""); // the one service whose rate is being edited
  const wasOpen = useRef(false);
  useEffect(() => { // closing the panel hands focus back to the button that opens it
    if (wasOpen.current && !open) addBtn.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const load = useCallback(() => api<VendorService[]>("vendor/services/list", { query: { page: 1, limit: 100 } })
    .then((r) => setList(r.data))
    .catch((e) => setError({ text: errText(e) })), []);
  const loadAsked = useCallback(() => api<ServiceRequest[]>("vendor/services/requests").then((r) => setAsked(r.data ?? [])).catch(() => {}), []);
  useEffect(() => {
    load();
    loadAsked();
    api<Category[]>("vendor/services/list-categories").then((r) => setCats([...r.data].sort((a, b) => rank(a) - rank(b)))).catch(() => {});
  }, [load, loadAsked]);
  useEffect(() => {
    if (!open) return;
    for (const c of cats) { // ponytail: one call per category (about ten); a grouped endpoint if the list grows
      if (!subsBy[c._id]) api<SubCategory[]>("vendor/services/list-subcategories", { query: { categoryId: c._id } })
        .then((r) => setSubsBy((m) => ({ ...m, [c._id]: r.data }))).catch(() => {});
    }
  }, [open, cats]); // subsBy left out on purpose: each category loads once

  const shown = (list ?? []).filter((x) => !gone.includes(x._id));
  const added = new Set(shown.map((x) => x.subcategory._id));
  const range: Range = cats.find((c) => c._id === add.cat);
  const check = () => ({
    cat: !add.cat ? "Choose a category." : undefined,
    sub: !add.sub ? "Choose a service." : added.has(add.sub) ? "You already offer this service." : undefined,
    addRate: rateError(add.rate) ?? rangeError(add.rate, range),
  });
  const errs: Errors = tried ? check() : {};

  function start() {
    setOpen(true);
    setTimeout(() => document.querySelector<HTMLButtonElement>("[aria-expanded]")?.focus());
  }
  function close() {
    setOpen(false);
    setTried(false);
    setError(null);
    setAdd({ cat: "", sub: "", rate: "", desc: "" });
    setOpenCat("");
    setAsk(null);
  }

  // OTHER = "Not in the list": no categoryId sent, no range hint, the rate optional (an admin picks the category).
  const askErrs = (a: NonNullable<typeof ask>) => ({
    askName: !a.name.trim() ? "Enter the service name." : undefined,
    askCat: !a.cat ? "Choose a category." : undefined,
    askRate: a.cat === OTHER && !a.rate ? undefined : rateError(a.rate),
  });
  function openAsk(name = "") {
    setOpen(true);
    setAsk({ name, cat: add.cat, rate: add.rate || mid(range) });
    setTimeout(() => document.getElementById("askName")?.focus());
  }
  async function request(e: FormEvent) {
    e.preventDefault();
    if (!ask) return;
    const bad = askErrs(ask);
    if (hasErrors(bad)) {
      setAsk({ ...ask, tried: true });
      return document.getElementById(Object.keys(bad).find((k) => bad[k as keyof typeof bad])!)?.focus();
    }
    setAsk({ ...ask, tried: true, error: undefined, existing: undefined, busy: true });
    try {
      const { data } = await api<ServiceRequest>("vendor/services/request", { method: "POST", body: ask.cat === OTHER
        ? { name: ask.name.trim(), ...(ask.rate && { hourlyRate: +ask.rate }) }
        : { name: ask.name.trim(), categoryId: ask.cat, hourlyRate: +ask.rate } });
      toast("Request sent.");
      setAsk(null);
      setAsked((a) => [data, ...a]);
    } catch (e) {
      // 409: already in the list; the reply names it so the Buddy can pick it instead.
      const d = e instanceof ApiError && e.status === 409 ? (e.data as { subCategoryId?: string; categoryId?: string } | null) : null;
      setAsk({ ...ask, tried: true, busy: false, error: errText(e), existing: d?.subCategoryId, cat: d?.categoryId || ask.cat });
    }
  }
  function pickExisting() {
    if (!ask?.existing) return;
    setAdd((a) => ({ ...a, cat: ask.cat, sub: ask.existing!, rate: ask.rate || a.rate }));
    setAsk(null);
    setTimeout(() => document.getElementById("sub")?.focus());
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (hasErrors(check())) return;
    setBusy(true);
    try {
      // v2: the rate goes with the add (one rate per service; the old profile rate is gone).
      await api("vendor/services/add", {
        method: "POST", body: { appliedServiceFor: add.sub, price: +add.rate, ...(add.desc.trim() && { description: add.desc.trim() }) },
      });
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

  const pending = asked.filter((r) => r.status === "pending").length; // counts as a service for sign-up
  function next() {
    if (shown.length || pending) return onDone();
    setNextError("Add at least one service to continue.");
    document.getElementById("svcSearch")?.focus();
  }

  // Search-first: Add saves at once, at the category's middle rate rounded to $5 (or $50); the rate is editable in the list.
  async function quickAdd(x: SubCategory) {
    const r = cats.find((c) => c._id === x.categoryId) ?? x;
    const m = Number(mid(r));
    setError(null);
    try {
      await api("vendor/services/add", { method: "POST", body: { appliedServiceFor: x._id, price: m ? Math.max(5, Math.round(m / 5) * 5) : 50 } });
      setNextError("");
      toast(`${x.serviceName} added.`);
      await load();
    } catch (e) {
      setError({ text: errText(e), needsAddress: /add your address/i.test(errText(e)) });
    }
  }

  return (
    <div className={`${s.form} ${s.narrow}`}>
      <ServiceSearch added={added} onAdd={quickAdd} onRequest={(text) => openAsk(text)} />
      {!open && error && (error.needsAddress ? (
        <p className="err" role="alert">{error.text} {mode === "edit" ? <Link href="/account/profile">Edit profile</Link> : onBack && <button type="button" className={s.link} onClick={onBack}>Go back to your profile</button>}</p>
      ) : <ServerError text={error.text} />)}
      <section className={s.stack} aria-labelledby="yours">
        <h2 id="yours">Your services{shown.length > 0 && <span className="muted"> ({shown.length})</span>}</h2>
        {list === null ? <div className="skeleton" style={{ height: 72 }} /> : shown.length === 0 && !asked.length ? (
          <div className={`box ${s.empty}`}>
            <Wrench size={20} aria-hidden />
            <p>No services yet. Add the services you offer so customers can book you.</p>
          </div>
        ) : (
          <ul className={`box ${s.list}`}>
            {shown.map((x) => <ServiceRow key={x._id} service={x} onSaved={load} onRemove={() => remove(x)}
              rateOpen={rateRow === x._id} onRateOpen={(o) => setRateRow(o ? x._id : "")} />)}
            {asked.map((r) => {
              const [word, tag] = ASKED[r.status];
              return (
                <li key={r._id} className={s.item}>
                  <div className={s.itemHead}>
                    <div>
                      <b>{r.name}</b>
                      <span className="muted"> · {r.categoryName ?? "No category"}{r.hourlyRate != null && ` · $${r.hourlyRate}/hr`}</span>
                      {r.status === "declined" && r.declineReason && <p className="hint">{r.declineReason}</p>}
                    </div>
                    <span className={`tag ${tag}`}>{word}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!open ? (
        <p><button ref={addBtn} type="button" className={`${s.link} ${s.tap} ${s.askLink}`} onClick={start}>Browse all services</button></p>
      ) : (
        <div className={`box ${s.addPanel}`}>
          {!ask && <form method="post" className={s.addPanel} onSubmit={submit} noValidate aria-labelledby="addTitle">
            <h3 id="addTitle">All services</h3>
            {/* As in the apps: categories as an accordion; each service adds at once with "+ Add", no rate box.
                The rate is changed on Your services. */}
            {(errs.sub || errs.cat) && <p id="sub" className="err" role="alert" tabIndex={-1}>{errs.cat ? "Choose a service." : errs.sub}</p>}
            <ul className={s.acc}>
              {cats.map((c) => {
                const list = subsBy[c._id], on = openCat === c._id;
                return (
                  <li key={c._id}>
                    <button type="button" className={s.accHead} aria-expanded={on} onClick={() => setOpenCat(on ? "" : c._id)}>
                      <span>{c.categoryName}</span>
                      {list && <span className="muted">{list.length}</span>}
                      <CaretDown size={16} aria-hidden />
                    </button>
                    {on && (
                      <ul className={s.accBody}>
                        {!list ? <li className="hint"><span className="spin" aria-hidden /> Loading…</li> : list.map((x) => {
                          const have = added.has(x._id), going = adding === x._id;
                          return (
                            <li key={x._id}>
                              <button type="button" className={s.accItem} disabled={have || !!adding} aria-busy={going}
                                onClick={async () => { setAdding(x._id); await quickAdd({ ...x, categoryId: c._id }); setAdding(""); }}>
                                <span>{x.serviceName}</span>
                                {have ? <span className="muted">Added</span> : going ? <span className="spin" aria-hidden /> : <b>+ Add</b>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            <button type="button" className={`${s.link} ${s.askLink}`} onClick={() => openAsk()}>Request a new service</button>
            {error && (error.needsAddress ? (
              <p className="err" role="alert">
                {error.text}{" "}
                {mode === "edit" ? <Link href="/account/profile">Edit profile</Link> : onBack && <button type="button" className={s.link} onClick={onBack}>Go back to your profile</button>}
              </p>
            ) : <ServerError text={error.text} />)}
            <span className={s.buttons}>
              <button type="button" className="btn lg" onClick={close}>Close</button>
            </span>
          </form>}
          {ask && (() => {
            const ae: Errors = ask.tried ? askErrs(ask) : {};
            return (
            <form method="post" className={s.addPanel} onSubmit={request} noValidate aria-labelledby="askTitle">
              <h3 id="askTitle">Request a new service</h3>
              <p className="hint">We review new services and add them for everyone.</p>
              <Field id="askName" label="Service name" required error={ae.askName}>
                <input autoComplete="off" maxLength={100} value={ask.name} onChange={(e) => setAsk({ ...ask, name: e.target.value, error: undefined, existing: undefined })} />
              </Field>
              <SelectField id="askCat" label="Category" required error={ae.askCat} placeholder="Choose a category" value={ask.cat}
                onChange={(cat) => setAsk({ ...ask, cat, rate: ask.rate || mid(cats.find((c) => c._id === cat)) })}
                options={[...cats.map((c) => ({ value: c._id, label: c.categoryName })), { value: OTHER, label: "Not in the list" }]} />
              <RateField id="askRate" value={ask.rate} error={ae.askRate} onChange={(rate) => setAsk({ ...ask, rate })} optional={ask.cat === OTHER}
                hint={ask.cat === OTHER ? "Optional. From $1 to $1,000. We review it with your request." : undefined} />
              {ask.error && (
                <p className="err" role="alert">
                  {ask.error}{" "}
                  {ask.existing && <button type="button" className={s.link} onClick={pickExisting}>Pick it instead</button>}
                </p>
              )}
              <span className={s.buttons}>
                <button className="btn p" disabled={ask.busy} aria-busy={ask.busy}>Send request</button>
                <button type="button" className="btn" onClick={() => setAsk(null)}>Cancel</button>
              </span>
            </form>
            );
          })()}
        </div>
      )}

      {mode === "onboarding" && (
        <form method="post" onSubmit={(e) => { e.preventDefault(); next(); }}>
          <Actions mode={mode} busy={false} onBack={onBack} error={nextError} label="Save" /> {/* every Get verified step says Save */}
        </form>
      )}
    </div>
  );
}
