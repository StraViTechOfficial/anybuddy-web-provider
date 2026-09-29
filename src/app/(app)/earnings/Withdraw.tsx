"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { day, money } from "@/lib/format";
import { useToast } from "@/components/Toast";
import type { Payout } from "@/lib/types";
import s from "./earnings.module.css";

type Props = { available: number; open?: Payout; last4: string | null; onDone: () => void };

// Withdraw to bank, inline. One open request at a time (the backend allows one); while it waits it replaces the button.
export function Withdraw({ available, open, last4, onDone }: Props) {
  const toast = useToast();
  const [panel, setPanel] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const start = () => {
    setAmount(available.toFixed(2));
    setError("");
    setPanel(true);
    setTimeout(() => input.current?.select());
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    const bad = !/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !(n > 0)
      ? "Enter an amount in dollars and cents, like 25.00."
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
      <form className={s.wd} onSubmit={submit} noValidate>
        <div className="field">
          <span><label htmlFor="amt">Amount to withdraw</label></span>
          <div className={s.money}>
            <span aria-hidden>$</span>
            <input id="amt" ref={input} inputMode="decimal" autoComplete="off" value={amount}
              onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "amt-err amt-hint" : "amt-hint"} />
          </div>
        </div>
        {error && <p id="amt-err" className="err">{error}</p>}
        <p id="amt-hint" className="hint">To bank ending {last4}. It shows as on its way until it is paid.</p>
        <div className={s.inline}>
          <button className="btn p lg" aria-busy={busy} disabled={busy}>Withdraw</button>
          <button type="button" className="btn lg" onClick={() => setPanel(false)}>Cancel</button>
        </div>
      </form>
    );
  } else {
    body = (
      <>
        <button className="btn p lg block" onClick={start} disabled={available <= 0}>Withdraw to bank</button>
        <p className="hint">{available > 0 ? `Goes to bank ending ${last4}.` : "Money from finished jobs becomes ready to withdraw here."}</p>
      </>
    );
  }
  return (
    <section className={`box pad ${s.side}`} aria-labelledby="wd-h">
      <h2 id="wd-h">Withdraw</h2>
      {body}
    </section>
  );
}
