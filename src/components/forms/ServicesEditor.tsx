"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Wrench } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { Category, SubCategory, VendorService } from "@/lib/types";
import { useVendor } from "@/components/Vendor";
import { useToast } from "@/components/Toast";
import { Actions, Field, errText, hasErrors, rateError, type Errors, type FormProps } from "./Field";
import { ServiceRow } from "./ServiceRow";
import s from "./forms.module.css";

const FIRST = ["Plumbing", "Electrical"]; // D-30 trades lead the list
const rank = (c: Category) => (FIRST.includes(c.categoryName) ? FIRST.indexOf(c.categoryName) : FIRST.length);

// Screen 2 and Account › Services. Every change saves at once; onboarding's Continue needs one service.
export function ServicesEditor({ mode, onDone, onBack }: FormProps) {
  const { vendor } = useVendor();
  const toast = useToast();
  const [list, setList] = useState<VendorService[] | null>(null);
  const [gone, setGone] = useState<string[]>([]); // removed, waiting out the Undo window
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [add, setAdd] = useState({ cat: "", sub: "", rate: "", desc: "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; needsAddress?: boolean } | null>(null);
  const [nextError, setNextError] = useState("");

  const load = useCallback(() => api<VendorService[]>("vendor/services/list", { query: { page: 1, limit: 100 } })
    .then((r) => setList(r.data)).catch((e) => setError({ text: errText(e) })), []);
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
  const check = () => ({
    cat: !add.cat ? "Choose a category." : undefined,
    sub: !add.sub ? "Choose a service." : shown.some((x) => x.subcategory._id === add.sub) ? "You already offer this service." : undefined,
    addRate: rateError(add.rate),
  });
  const errs: Errors = tried ? check() : {};

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
        .catch(() => toast("Service added, but its rate didn't save. Edit it to set the rate."));
      setAdd((a) => ({ ...a, sub: "", desc: "" }));
      setTried(false);
      setNextError("");
      toast("Service added.");
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
    document.getElementById("cat")?.focus();
  }

  return (
    <div className={s.form}>
      <div className={s.cols}>
        <section className={s.stack} aria-labelledby="yours">
          <h2 id="yours">Your services</h2>
          {list === null ? <div className="skeleton" style={{ height: 72 }} /> : shown.length === 0 ? (
            <div className={`box ${s.empty}`}>
              <Wrench size={20} aria-hidden />
              <p>No services yet. Add at least one service so customers can book you.</p>
            </div>
          ) : (
            <ul className={`box ${s.list}`}>
              {shown.map((x) => <ServiceRow key={x._id} service={x} onSaved={load} onRemove={() => remove(x)} />)}
            </ul>
          )}
        </section>
        <form className={s.stack} onSubmit={submit} noValidate aria-labelledby="addTitle">
          <h2 id="addTitle">Add a service</h2>
          <div className="row2">
            <Field id="cat" label="Category" error={errs.cat}>
              <select className="input" value={add.cat} onChange={(e) => setAdd({ ...add, cat: e.target.value, sub: "" })}>
                <option value="">Choose</option>
                {cats.map((c) => <option key={c._id} value={c._id}>{c.categoryName}</option>)}
              </select>
            </Field>
            <Field id="sub" label="Service" error={errs.sub}>
              <select className="input" value={add.sub} disabled={!subs.length} onChange={(e) => setAdd({ ...add, sub: e.target.value })}>
                <option value="">{add.cat ? "Choose" : "Choose a category first"}</option>
                {subs.map((c) => <option key={c._id} value={c._id}>{c.serviceName}</option>)}
              </select>
            </Field>
          </div>
          <Field id="addRate" label="Hourly rate (USD)" error={errs.addRate} hint="Whole dollars, $1 to $1,000.">
            <input inputMode="numeric" maxLength={4} value={add.rate} onChange={(e) => setAdd({ ...add, rate: e.target.value })} />
          </Field>
          <Field id="desc" label="Description" hint="Optional. What's included and the tools you bring.">
            <textarea className={`input ${s.short}`} maxLength={1000} value={add.desc} onChange={(e) => setAdd({ ...add, desc: e.target.value })} />
          </Field>
          {error && (
            <p className="err" role="alert">
              {error.text}{" "}
              {error.needsAddress && (mode === "edit" ? <Link href="/account/profile">Edit profile</Link> : onBack && <button type="button" className={s.link} onClick={onBack}>Go back to your profile</button>)}
            </p>
          )}
          <div><button className="btn lg" disabled={busy} aria-busy={busy}>Add service</button></div>
        </form>
      </div>
      {mode === "onboarding" && (
        <form onSubmit={(e) => { e.preventDefault(); next(); }}>
          <Actions mode={mode} busy={false} onBack={onBack} error={nextError} />
        </form>
      )}
    </div>
  );
}
