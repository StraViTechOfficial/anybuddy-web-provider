"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { api } from "@/lib/api";
import { clock, day, money } from "@/lib/format";
import type { Job } from "@/lib/types";
import { area, group, hours, JobTag, service, TABS, useNow } from "./bits";
import { payoutShort } from "@/components/job/Earn";
import { JobDetail } from "./JobDetail";
import s from "./jobs.module.css";

const LIMIT = 20;
const EMPTY: Record<string, string> = {
  requests: "No requests waiting. New job requests show up here. Keep your hours up to date so customers can book you.",
  upcoming: "No upcoming jobs. Requests you accept show up here.",
  done: "No completed jobs yet. Finished jobs and what you earned show up here.",
  cancelled: "Nothing canceled.",
};
const when = (j: Job) => `${day(j.scheduledDate)}${j.selectedSlot ? `, ${clock(j.selectedSlot)}` : ""}`;

// Laptop: list and detail side by side (?tab=&id=). Phone and tablet: the list; a tap opens /jobs/[id].
export function Jobs() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = TABS.find((t) => t[0] === params.get("tab")) ?? TABS[0];
  const [name, , status] = tab;
  const id = params.get("id");

  const [counts, setCounts] = useState<Record<number, number>>({});
  const [rows, setRows] = useState<Job[] | null>(null);
  const [page, setPage] = useState(1);
  const [end, setEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = useNow(status <= 2);

  const load = useCallback(async (p: number) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<Job[]>("vendor/bookings/list", { query: { status, page: p, limit: LIMIT } });
      const got = r.data.map((j) => ({ ...j, status })); // the list omits status: it is the tab's
      setRows((old) => (p === 1 ? got : [...(old ?? []), ...got])); // backend pages in a stable order (BUG-80)
      setCounts((c) => ({ ...c, [status]: r.count ?? 0 }));
      setPage(p);
      setEnd(got.length < LIMIT);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [status]);

  const loadCounts = useCallback(() => {
    for (const [, , st] of TABS)
      api("vendor/bookings/list", { query: { status: st, page: 1, limit: 1 } })
        .then((r) => setCounts((c) => ({ ...c, [st]: r.count ?? 0 })))
        .catch(() => {});
  }, []);

  useEffect(() => { setRows(null); load(1); }, [load]);
  useEffect(loadCounts, [loadCounts]);

  const refresh = () => { load(1); loadCounts(); };
  const open = (e: MouseEvent, j: Job) => {
    if (window.matchMedia("(max-width: 1020px)").matches) {
      e.preventDefault();
      router.push(`/jobs/${j._id}`);
    }
  };

  // Upcoming reads by date, soonest first; requests by the one that expires first.
  const sorted = [...(rows ?? [])];
  if (status === 1) sorted.sort((a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt)));
  if (status === 2) sorted.sort((a, b) => (a.scheduledDate + a.selectedSlot).localeCompare(b.scheduledDate + b.selectedSlot));

  // Laptop never shows an empty detail pane: open the first job of the tab (replace, so Back skips it).
  const first = sorted[0]?._id;
  useEffect(() => {
    if (!id && first && !window.matchMedia("(max-width: 1020px)").matches) router.replace(`/jobs?tab=${name}&id=${first}`);
  }, [id, first, name, router]);

  const row = (j: Job, i: number, all: Job[]) => {
    const g = group(j.scheduledDate, now);
    const sub = [status !== 2 ? clock(j.selectedSlot) : g === "Today" || g === "Tomorrow" ? null : day(j.scheduledDate), area(j), hours(j), status === 3 ? payoutShort(j) : null];
    const heading = status === 2 && (i === 0 || group(all[i - 1].scheduledDate, now) !== g) ? <div className={s.day}>{g}</div> : null;
    return (
      <div key={j._id} role="listitem">
        {heading}
        <Link className={s.row} href={`/jobs?tab=${name}&id=${j._id}`} aria-current={id === j._id || undefined} onClick={(e) => open(e, j)}>
          <time>{status === 2 ? clock(j.selectedSlot) : day(j.scheduledDate)}</time>
          <span className={s.what}>
            <b>{service(j)}</b>
            <small>{sub.filter(Boolean).join(", ")}</small>
          </span>
          {status === 3
            ? <span className={s.plus}>+{money(j.vendorPriceAfterDetection ?? 0)}</span>
            : <JobTag job={j} now={now} />}
        </Link>
      </div>
    );
  };

  return (
    <>
      <div className={s.top}>
      <h1>Jobs</h1>
      <nav className={s.segs} aria-label="Job lists">
        {TABS.map(([k, label, st]) => (
          <Link key={k} href={`/jobs?tab=${k}`} aria-current={k === name ? "page" : undefined}>
            {label}{counts[st] != null && <span className="muted">{counts[st]}</span>}
          </Link>
        ))}
      </nav>
      </div>
      <div className={`${s.split} ${id ? s.has : ""} fill`}>
        <div className={s.list}>
          <div className="box" role="list" aria-label={`${tab[1]} jobs`} aria-busy={rows === null}>
            {rows === null && !error && [0, 1, 2].map((i) => <div key={i} className={`skeleton ${s.ghost}`} />)}
            {rows?.length === 0 && <p className="pad muted">{EMPTY[name]}</p>}
            {sorted.map(row)}
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          {rows && !end && rows.length < (counts[status] ?? 0) && (
            <button className={`btn block ${s.more}`} onClick={() => load(page + 1)} aria-busy={busy} disabled={busy}>
              Load more
            </button>
          )}
        </div>
        <div className={s.detail}>
          {id
            ? <JobDetail key={id} id={id} back={`/jobs?tab=${name}`} onChange={refresh} embedded />
            : <p className="box pad muted">Select a job to see its details and next step.</p>}
        </div>
      </div>
    </>
  );
}
