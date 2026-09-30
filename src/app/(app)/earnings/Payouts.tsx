"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { ASKS_LEAD, instantFee } from "@/lib/pay";
import { loadStripe, token, type CardElement, type Stripe } from "@/lib/stripe";
import { useToast } from "@/components/Toast";
import { errText } from "@/components/forms/Field";
import type { PayoutAccount } from "@/lib/types";
import e from "./earnings.module.css";
import s from "./payouts.module.css";

type Props = { available: number; last4: string | null; acct: PayoutAccount | null; pk?: string; onDone: () => void };

// Owner 30 Sep: payouts are automatic after each job, in both modes; no withdraw button, no approval.
// Stripe mode can also pay the ready balance to a debit card now ("Get paid now", instant payout).
export function Payouts({ available, last4, acct, pk, onDone }: Props) {
  const [panel, setPanel] = useState<"" | "instant" | "card">("");
  const instant = !!(pk && acct?.instantAvailable && available > 0);
  let body;
  if (!last4) {
    body = <><p>Add your bank details to get paid.</p><Link className="btn p lg block" href="/account/bank">Add bank details</Link></>;
  } else if (panel && pk && acct) {
    body = <Instant available={available} acct={acct} pk={pk} replace={panel === "card"} onClose={() => setPanel("")} onDone={() => { setPanel(""); onDone(); }} />;
  } else {
    body = (
      <>
        <p>Paid to your bank after each job.</p>
        <p className="hint">Bank ending {last4}. <Link href="/account/bank">Bank details</Link></p>
        {acct?.requirements.some((r) => r.fix) && <p className="err">{ASKS_LEAD}. <Link href="/account/bank">Send it to Stripe</Link></p>}
        {instant && <button className="btn p lg block" onClick={() => setPanel("instant")}>{acct?.card ? "Get paid now" : "Add a debit card"}</button>}
        {pk && acct?.card && (
          <p className="hint">
            Instant payouts to {acct.card.brand ? `${acct.card.brand} ` : ""}card ending {acct.card.last4}.{" "}
            <button type="button" className="btn" onClick={() => setPanel("card")}>Change debit card</button>
          </p>
        )}
      </>
    );
  }
  return (
    <section className={`box pad ${e.side}`} aria-labelledby="po-h">
      <h2 id="po-h">Payouts</h2>
      {body}
    </section>
  );
}

// Instant payout of the ready balance to the Buddy's debit card; adds the card first when there is none.
// `replace`: only change the saved card, which needs the password (server rule: a new card receives instant payouts).
function Instant({ available, acct, pk, replace, onClose, onDone }: { available: number; acct: PayoutAccount; pk: string; replace: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(available.toFixed(2));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const card = useRef<{ stripe: Stripe; el: CardElement } | null>(null);
  const needCard = replace || !acct.card;
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!needCard) return;
    let el: CardElement | undefined, gone = false;
    loadStripe(pk).then((stripe) => {
      if (gone || !box.current) return;
      el = stripe.elements().create("card", { hidePostalCode: true, style: { base: { fontSize: "16px" } } });
      el.mount(box.current);
      el.on("change", (ev) => setError(ev.error?.message ?? ""));
      card.current = { stripe, el };
    }, (x) => setError(errText(x)));
    return () => { gone = true; el?.destroy(); };
  }, [needCard, pk]);

  const n = Number(amount);
  const ok = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && n > 0;
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const bad = replace ? (!password ? "Enter your password to change payout details." : "")
      : !ok ? "Enter an amount in dollars and cents, like 25.00." : n > available ? `You can get up to ${money(available)} now.`
      : n - instantFee(n) <= 0 ? "Instant payouts start above $0.51." : "";
    if (bad) return setError(bad);
    setBusy(true);
    setError("");
    try {
      if (needCard) {
        if (!card.current) throw new Error("The card form is still loading. Try again in a moment.");
        const cardToken = await token(card.current.stripe.createToken(card.current.el, { currency: "usd" }));
        await api("vendor/payouts/card", { method: "POST", body: { cardToken, ...(replace && { password }) } });
        if (replace) { toast("Card saved"); return onDone(); }
      }
      // amount leaves the balance, Stripe takes the fee out, net reaches the card.
      const { data } = await api<{ payoutId: string; amount: number; fee: number; net: number; arrivesBy: string | null }>("vendor/payouts/instant", { method: "POST", body: { amount: n } });
      toast(`${money(data.net)} is on its way to your card (fee ${money(data.fee)}).`);
      onDone();
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" className={s.wd} onSubmit={submit} noValidate>
      {!replace && <div className={s.exact}>
        <label htmlFor="amt">Amount</label>
        <div className={s.money}>
          <span aria-hidden>$</span>
          <input id="amt" inputMode="decimal" autoComplete="off" value={amount} disabled={busy}
            onChange={(x) => { setAmount(x.target.value); setError(""); }} onBlur={() => ok && setAmount(n.toFixed(2))}
            aria-invalid={!!error} aria-describedby="amt-hint" />
        </div>
      </div>}
      {!replace && <p id="amt-hint" className="hint">
        Fee about {money(ok ? instantFee(n) : 0)} (1.5%, at least $0.50), taken out. Arrives in about 30 minutes
        {acct.card ? ` on your ${acct.card.brand ? `${acct.card.brand} ` : ""}card ending ${acct.card.last4}` : ""}.
      </p>}
      {needCard && (
        <div className="field">
          <span className={s.label} id="card-l">Debit card</span>
          <div ref={box} className={s.card} role="group" aria-labelledby="card-l" />
          <small className="hint">Instant payouts go to a US debit card. The card number goes straight to Stripe.</small>
        </div>
      )}
      {replace && (
        <div className="field">
          <label htmlFor="card-pw">Your Any-Buddy password</label>
          <input id="card-pw" className="input" type="password" autoComplete="current-password" maxLength={128} value={password} disabled={busy}
            onChange={(x) => { setPassword(x.target.value); setError(""); }} />
          <small className="hint">Needed to change where your earnings go.</small>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      <div className={s.inline}>
        <button className="btn p lg" aria-busy={busy} disabled={busy}>{replace ? "Save card" : needCard ? "Save card and get paid" : "Get paid now"}</button>
        <button type="button" className="btn lg" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
