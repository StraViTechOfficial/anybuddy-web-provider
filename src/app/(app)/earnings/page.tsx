"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { day, dayKey, money } from "@/lib/format";
import { payoutAccount, payoutsConfig } from "@/lib/stripe";
import type { Balance, FinishedJob, Payout, PayoutAccount, StripePayout } from "@/lib/types";
import { Chart } from "./Chart";
import { fill, isPeriod, periodBars, PERIODS, type Period } from "./period";
import { Payouts } from "./Payouts";
import s from "./earnings.module.css";

// Manual mode reads our payout ledger; Stripe mode reads the Buddy's Stripe payouts instead.
type Data = { bal: Balance; jobs: FinishedJob[]; payouts: Payout[]; sent: StripePayout[]; last4: string | null; acct: PayoutAccount | null; pk?: string };
type Row = { id: string; at: string; what: string; sub: ReactNode; amount: number; sign: "+" | "-" | "" };

/** The business day of a timestamp, as "YYYY-MM-DD" in New York time. */
const jobAt = (j: FinishedJob) => j.checkOutAt ?? j.scheduledDate;
const payoutAt = (p: Payout) => (p.status === "paid" && p.paidAt) || p.requestedAt || p.createdAt;
const hrs = (n?: number) => (n ? `, ${n} hr${n === 1 ? "" : "s"}` : "");

async function load(): Promise<Data> {
  const payouts = async () => {
    const all: Payout[] = [];
    for (let page = 1; ; page++) {
      const r = await api<Payout[]>("vendor/earnings/payouts", { query: { page, limit: 100 } });
      all.push(...r.data);
      if (!r.data.length || all.length >= (r.count ?? 0)) return all;
    }
  };
  const cfg = await payoutsConfig();
  const [bal, jobs] = await Promise.all([
    api<Balance>("vendor/earnings/balance"),
    // ponytail: this loads one page of up to 1000 finished jobs. Add paging once a Buddy has more than that.
    api<FinishedJob[]>("vendor/bookings/list", { query: { status: 3, page: 1, limit: 1000 } }),
  ]);
  if (cfg.mode === "stripe" && cfg.publishableKey) {
    const [acct, list] = await Promise.all([payoutAccount(), api<{ rows: StripePayout[] }>("vendor/earnings/payouts")]);
    return { bal: bal.data, jobs: jobs.data, payouts: [], sent: list.data.rows ?? [], last4: acct.bank?.last4 ?? null, acct, pk: cfg.publishableKey };
  }
  const [bank, list] = await Promise.all([
    api<{ account_number?: string } | null>("vendor/auth/get-profile-details", { query: { type: 4 } }),
    payouts(),
  ]);
  return { bal: bal.data, jobs: jobs.data, payouts: list, sent: [], last4: bank.data?.account_number?.slice(-4) || null, acct: null };
}

function Earnings() {
  const q = useSearchParams().get("p");
  const period: Period = isPeriod(q) ? q : "month";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(() => load().then(setData, (e: Error) => setError(e.message)), []);
  useEffect(() => { refresh(); }, [refresh]);

  const filters = (
    <nav className={s.filters} aria-label="Period">
      {(Object.keys(PERIODS) as Period[]).map((k) => (
        <Link key={k} href={`?p=${k}`} replace scroll={false} aria-current={k === period ? "page" : undefined}>{PERIODS[k]}</Link>
      ))}
    </nav>
  );
  if (!data) {
    return (
      <>
        <div className={s.top}><h1>Earnings</h1>{filters}</div>
        {error ? <p className="err" role="alert">{error} <button className="btn" onClick={() => { setError(""); refresh(); }}>Try again</button></p>
          : <div className={`skeleton ${s.loading}`} aria-label="Loading earnings" />}
      </>
    );
  }

  const { bal, jobs, payouts, sent, last4, acct, pk } = data;
  const earnedItems = jobs.map((j) => ({ at: jobAt(j), key: dayKey(jobAt(j)), amount: j.vendorPriceAfterDetection }));
  const keys = [...earnedItems.map((i) => i.key), ...payouts.map((p) => dayKey(payoutAt(p))), ...sent.map((p) => dayKey(p.date))].sort();
  const { from, to, bars } = periodBars(period, dayKey(new Date()), keys[0]);
  const inPeriod = (at: string) => { const k = dayKey(at); return from <= k && k <= to; };
  const sum = (items: { at: string; amount: number }[]) => items.filter((i) => inPeriod(i.at)).reduce((c, i) => c + Math.round(i.amount * 100), 0) / 100;
  const earned = sum(earnedItems);
  const paid = pk
    ? sum(sent.filter((p) => p.status === "paid").map((p) => ({ at: p.date, amount: p.amount })))
    : sum(payouts.filter((p) => p.type === "withdrawal" && p.status === "paid").map((p) => ({ at: payoutAt(p), amount: p.amount })));
  // In Stripe mode there is no fee ledger here, only the all-time total that the balance call returns.
  const taken = pk ? bal.deductions : sum(payouts.filter((p) => p.type === "deduction").map((p) => ({ at: payoutAt(p), amount: p.amount })));
  const fixBank = <Link href="/account/bank">Update your bank details</Link>;
  const label = PERIODS[period].toLowerCase();

  const rows: Row[] = [
    ...jobs.map((j): Row => ({ id: j._id, at: jobAt(j), what: j.services?.serviceName || "Job", sub: `Job finished${hrs(j.hoursWorked)}`, amount: j.vendorPriceAfterDetection, sign: "+" })),
    ...payouts.map((p): Row => {
      const base = { id: p._id, at: payoutAt(p), amount: p.amount, sign: "" as const };
      if (p.type === "deduction") return { ...base, what: "Taken off", sub: p.note || "Card fee for a job you canceled", sign: "-" };
      if (p.status === "paid") return { ...base, what: "Paid to your bank", sub: last4 ? `Bank ending ${last4}` : "Bank transfer" };
      if (p.status === "rejected") return { ...base, what: "Payout not sent", sub: `Back in your balance.${p.note ? ` ${p.note}` : ""}` };
      return { ...base, what: "On its way to your bank", sub: "Sent" };
    }),
    ...sent.map((p, i): Row => {
      const to = p.method === "instant" ? "card" : "bank";
      const base = { id: `sp${i}`, at: p.date, amount: p.amount, sign: "" as const };
      const where = p.method === "instant" ? `Instant${acct?.card ? `, card ending ${acct.card.last4}` : ""}` : last4 ? `Bank ending ${last4}` : "Bank transfer";
      if (p.status === "paid") return { ...base, what: `Paid to your ${to}`, sub: where };
      if (p.status === "failed") return { ...base, what: "Payout failed", sub: <>Back in your balance. {fixBank}</> };
      return { ...base, what: `On its way to your ${to}`, sub: `${where}. ${p.arrivesBy ? `Arrives ${day(p.arrivesBy)}` : "Sent"}` };
    }),
  ].filter((r) => inPeriod(r.at)).sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <>
      <div className={s.top}><h1>Earnings</h1>{filters}</div>
      <dl className={`box ${s.kpis}`}>
        <div><dt>Balance</dt><dd>{money(bal.available)}</dd><dd>Paid to your bank after each job</dd></div>
        <div><dt>On its way to your bank</dt><dd>{money(bal.pending)}</dd><dd>Sent, not in your bank yet</dd></div>
        <div><dt>Paid to your bank</dt><dd>{money(paid)}</dd><dd>{PERIODS[period]}</dd></div>
        <div><dt>Taken off</dt><dd>{money(taken)}</dd><dd>{pk ? "All time. " : ""}Card fees for jobs you canceled after accepting</dd></div>
      </dl>
      <div className={`${s.grid} fill`}>
        <Payouts available={bal.instantAvailable ?? bal.available} pending={bal.pending} last4={last4} acct={acct} pk={pk} onDone={refresh} />
          <section className={`box pad ${s.left}`} aria-labelledby="chart-h">
            <h2 id="chart-h" className={s.ch}>Earned {label} <b>{money(earned)}</b></h2>
            <p className="hint">{period === "week" ? "Per day" : period === "all" ? "Per month" : "Per week, Monday to Sunday"}. Your share of finished jobs.</p>
            <Chart key={period} bars={fill(bars, earnedItems)} title={`Earned ${label}, ${money(earned)}`} />
          </section>
          <section className={s.feedSec} aria-labelledby="feed-h">
            <h2 id="feed-h" className={s.fh}>Money in and out</h2>
            <div className={`box ${s.feedBox}`}>
              {rows.length ? (
                <ul className={s.feed}>
                  {rows.map((r) => (
                    <li key={r.id}>
                      <div><b>{r.what}</b><small>{day(r.at)}. {r.sub}</small></div>
                      <span className={r.sign === "+" ? s.plus : r.sign === "-" ? s.minus : undefined}>{r.sign}{money(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="pad muted">{period === "all" ? "Nothing yet" : `Nothing ${label}`}. Finished jobs, payouts and fees show up here.</p>}
            </div>
          </section>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Earnings /></Suspense>;
}
