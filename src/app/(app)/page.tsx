"use client";
// Home: the live board. The job in hand and requests with timers first; money lives on Earnings (D-37, D-38).
// Laptop shows a week, tablet 3 days, phone a 7-day strip; the range start lives in the URL (?from=YYYY-MM-DD, TSK-70).
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { TZ } from "@/lib/format";
import type { Availability, JobBooking } from "@/lib/types";
import { Agenda } from "@/components/board/Agenda";
import { Board } from "@/components/board/Board";
import { RangeNav } from "@/components/board/RangeNav";
import { boardItems, pickDefault, urgent } from "@/components/board/items";
import { JobActions } from "@/components/job/JobActions";
import { addDays, daysFrom, hm, isDayKey, minuteOf, serviceOf, useNow, ymd } from "@/components/job/when";
import s from "@/components/board/Board.module.css";
import { Checklist, SetupNote } from "@/components/Checklist";
import { useVendor } from "@/components/Vendor";

type Lists = { reqs: JobBooking[]; jobs: JobBooking[] };
const list = (status: 1 | 2 | 3, limit: number) =>
  api<JobBooking[]>("vendor/bookings/list", { query: { status, page: 1, limit } }).then((r) => r.data);
const longDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const TABLET = "(min-width: 700px) and (max-width: 1020px)";

export default function Page() {
  const { vendor, onboarding } = useVendor();
  if (!vendor || !onboarding) return null; // the app layout is loading the Buddy
  // D-51: until admin approval, Home is "Get verified" (v3; no board, jobs or earnings).
  if (vendor.verificationStatus !== 1) return <Checklist vendor={vendor} onboarding={onboarding} />;
  return <><SetupNote onboarding={onboarding} /><Suspense><Home /></Suspense></>;
}

function Home() {
  const now = useNow();
  const today = ymd(now);
  const param = useSearchParams().get("from");
  const from = isDayKey(param) ? param : today;
  const [len, setLen] = useState(() => (typeof window !== "undefined" && matchMedia(TABLET).matches ? 3 : 7));
  useEffect(() => {
    const mq = matchMedia(TABLET);
    const set = () => setLen(mq.matches ? 3 : 7);
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  const days = daysFrom(from, len);
  const range = days.join();

  const [lists, setLists] = useState<Lists | null>(null);
  const [past, setPast] = useState<Record<string, JobBooking[]>>({});
  const pastRef = useRef(past);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string>();
  const [detail, setDetail] = useState<JobBooking | null>(null);
  const [tick, setTick] = useState(0);
  const focusRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api<Availability>("vendor/auth/get-profile-details", { query: { type: 2 } }).then((r) => setAvail(r.data)).catch(() => {});
  }, []);

  // Fewest calls for the visible range: requests always (the phone lists them all); upcoming jobs when the range reaches
  // today or later; today's finished jobs when today shows; one list-day-wise per past day, once (history doesn't change).
  // ponytail: first 100 upcoming and newest 20 finished; page through if a Buddy ever holds more.
  const load = useCallback(async () => {
    const ds = range.split(","), t = ymd(new Date());
    const newPast = ds.filter((d) => d < t && !pastRef.current[d]);
    try {
      const [reqs, upcoming, done, ...pastDays] = await Promise.all([
        list(1, 50),
        ds.some((d) => d >= t) ? list(2, 100) : [],
        ds.includes(t) ? list(3, 20) : [],
        ...newPast.map((date) => api<JobBooking[]>("vendor/bookings/list-day-wise", { method: "PUT", query: { date } }).then((r) => r.data)),
      ]);
      if (newPast.length) {
        pastRef.current = { ...pastRef.current, ...Object.fromEntries(newPast.map((d, i) => [d, pastDays[i]])) };
        setPast(pastRef.current);
      }
      setLists({ reqs, jobs: [...upcoming, ...done] });
      setErr("");
      setTick((n) => n + 1);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Your board didn't load. Try again.");
    }
  }, [range]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const go = useCallback((to: string | 0 | 1 | -1) => {
    const key = to === 0 ? today : typeof to === "number" ? addDays(from, to * len) : to;
    // Native pushState: Next syncs useSearchParams with it, with no server round trip, so fast clicks stack up.
    window.history.pushState(null, "", key === today ? "/" : `/?from=${key}`);
  }, [today, from, len]);

  const todayIdx = days.indexOf(today);
  const pastList = days.filter((d) => d < today).flatMap((d) => past[d] ?? []);
  const all = lists ? [...lists.reqs, ...lists.jobs, ...pastList] : [];
  const items = boardItems(all, days);
  const requests = urgent(lists?.reqs ?? []);
  const nowMin = minuteOf(now);
  const shown = (id?: string) => !!id && (items.some((x) => x.b._id === id) || requests.some((r) => r._id === id));
  const current = shown(sel) ? sel : pickDefault(items, nowMin, todayIdx);

  // The focused booking's detail carries the customer's phone; the list item shows until it arrives.
  useEffect(() => {
    if (!current) return;
    api<JobBooking>("vendor/bookings/detail", { query: { bookingId: current } }).then((r) => setDetail(r.data)).catch(() => setDetail(null));
  }, [current, tick]);
  const listed = all.find((b) => b._id === current);
  const focused = detail && current && detail._id === current ? { ...detail, ...listed, user_details: detail.user_details } : listed;

  // Select a booking; one off the board (a request, the job in progress) brings its days into view.
  const pick = (id: string) => {
    setSel(id);
    const b = all.find((x) => x._id === id), key = b && ymd(b.scheduledDate);
    if (key && !days.includes(key)) go(key >= today && key < addDays(today, len) ? 0 : key);
    if (window.innerWidth < 700) {
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => focusRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }), 0);
    }
  };

  // Keys (laptop): arrows move between blocks, A accepts, D opens decline, [ ] or Page Up/Down change the range.
  const order = items.map((x) => x.b._id).join();
  useEffect(() => {
    const ids = order ? order.split(",") : [];
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,select,textarea,[contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && ids.length) {
        e.preventDefault();
        const i = ids.indexOf(current ?? "");
        const next = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
        setSel(next);
        setTimeout(() => document.querySelector<HTMLElement>(`[data-id="${next}"]`)?.focus(), 0);
      }
      if (e.key === "[" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      if (e.key === "]" || e.key === "PageDown") { e.preventDefault(); go(1); }
      const k = e.key.toLowerCase();
      if (k === "a" || k === "d") document.querySelector<HTMLElement>(`#focus [data-key="${k}"]`)?.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [order, current, go]);

  if (!lists) {
    return (
      <>
        <h1>Today</h1>
        {err ? (
          <p className="err" role="alert">{err} <button className="btn" onClick={load}>Try again</button></p>
        ) : (
          <div className={s.board} aria-busy="true"><div className="skeleton" style={{ height: 360 }} /><div className="skeleton" style={{ height: 360 }} /></div>
        )}
      </>
    );
  }

  // The brief line is about today, whatever range shows.
  const prog = lists.jobs.find((b) => b.status === 2 && b.checkInAt);
  const later = lists.jobs.filter((b) => b.status === 2 && !b.checkInAt && ymd(b.scheduledDate) === today).length;
  const unit = len === 3 ? "3 days" : "week";
  const nav = (cls: string) => <RangeNav days={days} isToday={from === today} unit={unit} go={go} className={cls} />;
  const stale = focused && ymd(focused.scheduledDate) < today && (focused.status === 1 || focused.status === 2);
  return (
    <>
      <div className={s.hhead}>
        <div>
          <h1>Today</h1>
          <p className="sub">{longDate.format(now)} · <time>{hm(nowMin)}</time></p>
        </div>
        <p className={s.brief}>
          {requests.length ? (
            <button type="button" onClick={() => pick(requests[0]._id)}><b>{requests.length}</b>request{requests.length > 1 ? "s" : ""} to answer</button>
          ) : <span>No requests waiting</span>}
          {prog && <button type="button" onClick={() => pick(prog._id)}><b>1</b>job in progress</button>}
          <span><b>{later}</b>more today</span>
        </p>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className={`${s.board} fill`}>
        <div className={s.col}>
          {nav(s.wideOnly)}
          <Board items={items} days={days} today={today} avail={avail} sel={current} onSel={pick} now={now} nowMin={nowMin} unit={unit} />
        </div>
        <Agenda items={items} avail={avail} requests={requests} days={days} today={today} sel={current} onSel={pick} now={now} nowMin={nowMin} nav={nav("")} />
        <aside id="focus" ref={focusRef} className={`box ${s.focus}`} aria-label="Selected job">
          {focused ? (
            <>
              <div className={s.fhead}>
                <h2 className={s.ft}>{serviceOf(focused)}</h2>
                {focused.status !== 1 && <Link className="btn" href={`/jobs/${focused._id}`}>Job details</Link>}
              </div>
              {stale ? <p className="muted">This day has passed. The job was not started.</p> : <JobActions booking={focused} onChange={load} />}
            </>
          ) : (
            <p className="muted">Nothing needs you right now. New requests appear here the moment a customer books you.</p>
          )}
        </aside>
      </div>
    </>
  );
}
