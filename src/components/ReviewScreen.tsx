"use client";
// D-51 (contract: "Once it's approved by the admin then the service provider will be able to explore the application"):
// until approval, Home is this screen. Setup stays editable; the board, jobs and earnings open after approval.
import Link from "next/link";
import { CheckCircle, CircleNotch, WarningCircle, type Icon } from "@phosphor-icons/react";
import type { Vendor } from "@/lib/types";
import s from "./ReviewScreen.module.css";

const STEPS: [string, string][] = [
  ["Profile", "/account/profile"],
  ["Services and rates", "/account/services"],
  ["Working hours", "/hours"],
  ["Documents", "/account/documents"],
  ["Bank details", "/account/bank"],
];

export function ReviewScreen({ vendor }: { vendor: Vendor }) {
  const changes = vendor.verificationStatus === 2;
  const Last: Icon = changes ? WarningCircle : CircleNotch;
  return (
    <div className={s.wrap}>
      <h1>{changes ? "Your application needs changes" : "Your application is under review"}</h1>
      <p className="sub">
        {changes
          ? "Our team emailed you what to update. Make the changes below, then contact support so we can check again."
          : "Our team is checking your documents. Customers can book you once you're approved. We email you when it's done."}
      </p>
      <ol className={`box ${s.steps}`}>
        {STEPS.map(([label, href]) => (
          <li key={href}>
            <span><CheckCircle size={20} weight="fill" className={s.done} aria-hidden />{label}<span className="sr"> done</span></span>
            <Link href={href} className="btn">Edit</Link>
          </li>
        ))}
        <li className={changes ? s.bad : s.now}>
          <span><Last size={20} aria-hidden />Admin review</span>
          <span className={`tag ${changes ? "t-bad" : "t-wait"}`}>{changes ? "Changes needed" : "In progress"}</span>
        </li>
      </ol>
      <p className={s.help}>
        <Link href="/account/help" className="btn lg">Contact support</Link>
      </p>
    </div>
  );
}
