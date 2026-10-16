"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { Availability, JobBooking, Leave, VendorHours } from "@/lib/types";
import { fit, ymd } from "@/components/job/when";
import { Clashes, type Clash } from "./Clashes";
import { useToast } from "@/components/Toast";
import { Actions, errText, hasErrors, type Errors, type FormProps } from "./Field";
import { TimeOff } from "./TimeOff";
import { TimeSelect } from "@/components/ui/TimeSelect";
import s from "./forms.module.css";

type Day = { isOpen: boolean; from: string; to: string };
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // shown Monday first; the server's day is 0 = Sunday
const START: Day[] = NAMES.map((_, i) => ({ isOpen: i >= 1 && i <= 5, from: "09:00", to: "17:00" }));

// Onboarding's hours step and the Hours tab. "HH:mm" strings compare correctly as text.
export function HoursEditor({ mode, onDone, onBack }: FormProps) {
  const toast = useToast();
  const [days, setDays] = useState(START);
  const [brk, setBrk] = useState({ on: false, from: "12:00", to: "13:00" });
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false); // inputs stay disabled until the saved values are in
  const [upcoming, setUpcoming] = useState<JobBooking[]>([]);
  const [clash, setClash] = useState<Clash[] | null>(null);

  // Edit mode only (a new Buddy has no bookings): requests and confirmed jobs, checked on Save.
  useEffect(() => {
    if (mode !== "edit") return;
    Promise.all([1, 2].map((status) => api<JobBooking[]>("vendor/bookings/list", { query: { status, page: 1, limit: 100 } })))
      .then((r) => setUpcoming(r.flatMap((x, i) => x.data.map((b) => ({ ...b, status: i + 1 }) as JobBooking))))
      .catch(() => {}); // the warning is a courtesy; saving still works without it
  }, [mode]);
  useEffect(() => setClash(null), [days, brk, leaves]);

  useEffect(() => {
    api<VendorHours>("vendor/auth/get-profile-details", { query: { type: 2 } })
      .then(({ data }) => {
        if (data?.availability?.length) {
          setDays((old) => old.map((d, i) => {
            const a = data.availability!.find((x) => x.day === i);
            return a ? { isOpen: a.isOpen, from: a.from || d.from, to: a.to || d.to } : d;
          }));
        }
        if (data?.breakStart && data.breakEnd) setBrk({ on: true, from: data.breakStart, to: data.breakEnd });
        setLeaves((data?.leaves ?? []).filter((l) => l.date).map((l) => ({ date: l.date.slice(0, 10), description: l.description ?? "" })));
      })
      .then(() => setLoaded(true))
      .catch((e) => setError(errText(e)));
  }, []);

  const setDay = (i: number, patch: Partial<Day>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const check = (): Errors => {
    const e: Errors = {};
    const open = ORDER.filter((i) => days[i].isOpen);
    if (!open.length) e[`on-1`] = "Open at least one day.";
    for (const i of open) if (days[i].to <= days[i].from) e[`to-${i}`] = "The end time must be after the start time.";
    if (brk.on) {
      if (brk.to <= brk.from) e.breakTo = "The break must end after it starts.";
      else {
        const out = open.find((i) => brk.from < days[i].from || brk.to > days[i].to);
        if (out !== undefined) e.breakFrom = `The break must fit inside ${NAMES[out]}'s hours.`;
      }
    }
    return e;
  };
  const errs: Errors = tried ? check() : {};

  function copyMonday() {
    setDays((d) => d.map((x, i) => (i >= 2 && i <= 5 ? { ...d[1] } : x)));
    toast("Monday's hours copied to Tuesday to Friday.");
  }

  const schedule = (): Availability => ({
    availability: days.map((d, day) => ({ day, ...d })),
    breakStart: brk.on ? brk.from : "",
    breakEnd: brk.on ? brk.to : "",
    leaves,
  });

  async function submit(e?: FormEvent, anyway = false) {
    e?.preventDefault();
    setTried(true);
    setError("");
    if (hasErrors(check())) return;
    if (!anyway) {
      const today = ymd(new Date());
      const found = upcoming
        .filter((b) => ymd(b.scheduledDate) >= today)
        .map((b) => ({ b, r: fit(b, schedule(), []) }))
        .filter(({ r }) => r[0] === "warn")
        .map(({ b, r }) => ({ b, why: r[1] }));
      if (found.length) return setClash(found);
    }
    setBusy(true);
    try {
      await api("vendor/auth/update-register-profile", {
        method: "POST",
        body: { step: 2, ...schedule() },
      });
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
      <div className={`${s.cols} ${s.even}`}>
        <section className={s.stack} aria-labelledby="weekly">
          <div className={s.head}>
            <h2 id="weekly">Weekly hours</h2>
            <button type="button" className="btn" onClick={copyMonday}>Copy Monday to weekdays</button>
          </div>
          <div className={`box ${s.list}`}>
            {ORDER.map((i) => {
              const d = days[i];
              const err = errs[`to-${i}`] ?? (i === 1 ? errs["on-1"] : undefined);
              return (
                <div key={i} className={s.day}>
                  <label className={s.toggle}>
                    <input id={`on-${i}`} type="checkbox" checked={d.isOpen} onChange={(e) => setDay(i, { isOpen: e.target.checked })}
                      aria-describedby={err ? `err-${i}` : undefined} />
                    <span className={s.sw} aria-hidden />
                    <b>{NAMES[i]}</b>
                  </label>
                  {d.isOpen ? (
                    <span className={s.times}>
                      <TimeSelect label={`${NAMES[i]} start`} hideLabel value={d.from} onChange={(v) => setDay(i, { from: v })} />
                      <span className="muted">to</span>
                      <TimeSelect id={`to-${i}`} label={`${NAMES[i]} end`} hideLabel value={d.to}
                        invalid={!!errs[`to-${i}`]} describedBy={err ? `err-${i}` : undefined} onChange={(v) => setDay(i, { to: v })} />
                    </span>
                  ) : <span className="muted">Closed</span>}
                  {err && <small id={`err-${i}`} className={`err ${s.full}`}>{err}</small>}
                </div>
              );
            })}
          </div>
        </section>
        <section className={s.stack} aria-labelledby="breakTitle">
          <div className={s.head}><h2 id="breakTitle">Break and time off</h2></div>
          <div className={`box ${s.list}`}>
            <div className={s.day}>
              <label className={s.toggle}>
                <input type="checkbox" checked={brk.on} onChange={(e) => setBrk({ ...brk, on: e.target.checked })} />
                <span className={s.sw} aria-hidden />
                <b>Daily break</b>
              </label>
              {brk.on ? (
                <span className={s.times}>
                  <TimeSelect id="breakFrom" label="Break start" hideLabel value={brk.from}
                    invalid={!!errs.breakFrom} describedBy={errs.breakFrom || errs.breakTo ? "breakErr" : undefined} onChange={(v) => setBrk({ ...brk, from: v })} />
                  <span className="muted">to</span>
                  <TimeSelect id="breakTo" label="Break end" hideLabel value={brk.to}
                    invalid={!!errs.breakTo} describedBy={errs.breakFrom || errs.breakTo ? "breakErr" : undefined} onChange={(v) => setBrk({ ...brk, to: v })} />
                </span>
              ) : <span className="muted">Optional</span>}
              {(errs.breakFrom || errs.breakTo) && <small id="breakErr" className={`err ${s.full}`} role="alert">{errs.breakFrom ?? errs.breakTo}</small>}
            </div>
            <TimeOff leaves={leaves} onChange={setLeaves} />
            <p className={`hint ${s.foot}`}>Customers only see times inside your hours, outside your break and not on days off. Times are New York time.</p>
          </div>
        </section>
      </div>
      {clash && <Clashes list={clash} busy={busy} onSave={() => submit(undefined, true)} onKeep={() => setClash(null)} />}
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} />
      </fieldset>
    </form>
  );
}
