"use client";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { day, money } from "@/lib/format";
import { useToast } from "@/components/Toast";
import type { Payout } from "@/lib/types";
import e from "./earnings.module.css";
import s from "./withdraw.module.css";

type Props = { available: number; open?: Payout; last4: string | null; onDone: () => void };
const MIN = 1;
const SHARES = [["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["All", 1]] as const;

// Withdraw to bank, inline. One open request at a time (the backend allows one); while it waits it replaces the button.
// Slider, quick shares and the exact field all edit one amount.
export function Withdraw({ available, open, last4, onDone }: Props) {
  const toast = useToast();
  const [panel, setPanel] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const n = Number(amount);
  const ok = /^\d+(\.\d{1,2})?$/.test(amount.trim());
  const slid = ok ? Math.min(available, Math.max(MIN, n)) : MIN;
  const share = (p: number) => Math.max(MIN, Math.floor(available * p * 100) / 100);
  const set = (v: number) => { setAmount(v.toFixed(2)); setError(""); };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const bad = !ok ? "Enter an amount in dollars and cents, like 25.00."
      : n < MIN ? `Withdrawals start at ${money(MIN)}.`
      : n > available ? `You can withdraw up to ${money(available)}.` : "";
    if (bad) { setError(bad); input.current?.focus(); return; }
    setBusy(true);
    try {
      await api("vendor/earnings/withdraw", { method: "POST", body: { amount: n } });
      setPanel(false);
      toast(`${money(n)} is on its way to your bank.`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (open) {
    body = <p>Your withdrawal from {day(open.requestedAt ?? open.createdAt)} is on its way to your bank. You can withdraw again once it is paid.</p>;
  } else if (!last4) {
    body = <><p>Add your bank details to withdraw.</p><Link className="btn p lg block" href="/account/bank">Add bank details</Link></>;
  } else if (panel) {
    body = (
      <form method="post" className={s.wd} onSubmit={submit} noValidate>
        <div>
          <p className={s.big} aria-hidden>{money(ok ? n : 0)}</p>
          <p className="hint">To bank ending {last4}</p>
        </div>
        <div>
          <input
            type="range" className={s.range} aria-label="Amount to withdraw" aria-valuetext={money(slid)}
            min={MIN} max={available} step={available >= 20 ? 1 : 0.01} value={slid} disabled={busy}
            style={{ "--p": `${((slid - MIN) / Math.max(available - MIN, 0.01)) * 100}%` } as CSSProperties}
            onChange={(ev) => set(Number(ev.target.value))}
          />
          <div className={s.ends} aria-hidden><span>{money(MIN)}</span><span>{money(available)}</span></div>
        </div>
        <div className={s.chips} role="group" aria-label="Quick amounts">
          {SHARES.map(([name, p]) => (
            <button key={name} type="button" className="btn" aria-pressed={ok && n === share(p)} disabled={busy}
              aria-label={`${name === "All" ? "All" : `${name} of what is ready`}, ${money(share(p))}`} onClick={() => set(share(p))}>{name}</button>
          ))}
        </div>
        <div className={s.exact}>
          <label htmlFor="amt">Exact amount</label>
          <div className={s.money}>
            <span aria-hidden>$</span>
            <input id="amt" ref={input} inputMode="decimal" autoComplete="off" value={amount} disabled={busy}
              onChange={(ev) => { setAmount(ev.target.value); setError(""); }}
              onBlur={() => ok && setAmount(n.toFixed(2))}
              aria-invalid={!!error} aria-describedby={error ? "amt-err amt-hint" : "amt-hint"} />
          </div>
        </div>
        {error && <p id="amt-err" className="err">{error}</p>}
        <p id="amt-hint" className="hint">It shows as on its way until it is paid.</p>
        <div className={s.inline}>
          <button className="btn p lg" aria-busy={busy} disabled={busy}>Withdraw</button>
          <button type="button" className="btn lg" onClick={() => setPanel(false)}>Cancel</button>
        </div>
      </form>
    );
  } else {
    body = (
      <>
        <button className="btn p lg block" onClick={() => { set(available); setPanel(true); }} disabled={available < MIN}>Withdraw to bank</button>
        <p className="hint">{available >= MIN ? `Goes to bank ending ${last4}.` : `Money from finished jobs becomes ready to withdraw here, from ${money(MIN)}.`}</p>
      </>
    );
  }
  return (
    <section className={`box pad ${e.side}`} aria-labelledby="wd-h">
      <h2 id="wd-h">Withdraw</h2>
      {body}
    </section>
  );
}
