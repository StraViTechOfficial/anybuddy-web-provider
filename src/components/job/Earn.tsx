"use client";
import Link from "next/link";
import { day, money } from "@/lib/format";
import { PAYOUT_WORD, shareOf } from "@/lib/pay";
import type { Booking } from "@/lib/types";
import s from "./JobActions.module.css";

/** "You earn $X" only (no customer total, fee or tax on the Buddy's screens; same as iOS). */
export function Earn({ b }: { b: Booking }) {
  const share = shareOf(b);
  if (share === null) return null;
  return (
    <div className={s.earn}>
      <p>You earn <b>{money(share)}</b></p>
    </div>
  );
}

/** Where the pay for a done job is: the payout status (Stripe mode), else the manual-mode note. */
export function PayoutLine({ b }: { b: Booking }) {
  const st = b.payoutStatus;
  if (!st) return <p className="hint">In your Earnings balance. Paid to your bank after each job.</p>;
  const when = b.payoutArrivesBy && (st === "sent" || st === "paid") ? `, ${st === "paid" ? "arrived" : "arrives"} ${day(b.payoutArrivesBy)}` : "";
  return (
    <p className="hint">
      <b>Payout: {PAYOUT_WORD[st]}</b>{when}.{" "}
      {st === "pending" && "On its way soon."}
      {st === "failed" && <>Your bank didn&apos;t take it. <Link href="/account/bank">Update your bank details</Link></>}
      {st === "reversed" && "Taken back after a refund."}
    </p>
  );
}

/** Short payout words for list rows: "Paid", "Sent, arrives Thu, Oct 2". Empty in manual mode. */
export const payoutShort = (b: Booking) =>
  !b.payoutStatus ? "" : PAYOUT_WORD[b.payoutStatus] + (b.payoutStatus === "sent" && b.payoutArrivesBy ? `, arrives ${day(b.payoutArrivesBy)}` : "");
