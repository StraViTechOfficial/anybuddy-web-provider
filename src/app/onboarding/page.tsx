"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { VendorBank, VendorDocs, VendorHours, VendorProfile, VendorService } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { useVendor } from "@/components/Vendor";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { ServicesEditor } from "@/components/forms/ServicesEditor";
import { HoursEditor } from "@/components/forms/HoursEditor";
import { DocumentsForm } from "@/components/forms/DocumentsForm";
import { BankForm } from "@/components/forms/BankForm";
import type { FormProps } from "@/components/forms/Field";
import s from "./onboarding.module.css";

// Same order as the owner-approved iOS flow. Server steps: 1 profile, 2 hours, 3 documents, 4 bank, 5 done;
// Services has no server step.
const STEPS: [string, string, (p: FormProps) => React.ReactNode][] = [
  ["Your profile", "Customers see this when they book you.", ProfileForm],
  ["Services and rates", "Add each service you offer and its hourly rate. Customers book these.", ServicesEditor],
  ["Working hours and time off", "Customers can only book you inside these hours.", HoursEditor],
  ["Documents", "Our team reviews the documents every Buddy sends, to protect customers and keep trust.", DocumentsForm],
  ["Payout details", "The bank account where your earnings are sent.", BankForm],
];

/** The first screen whose data is missing (1 to 5), or 6 when everything is in.
 *  ponytail: read from the data, because get-profile-details doesn't return `step`; use vendor.step once it does. */
async function resume(): Promise<number> {
  const get = <T,>(type: number) => api<T>("vendor/auth/get-profile-details", { query: { type } }).then((r) => r.data);
  const [p, svc, h, d, b] = await Promise.all([
    get<VendorProfile>(1),
    api<VendorService[]>("vendor/services/list", { query: { page: 1, limit: 1 } }),
    get<VendorHours>(2), get<VendorDocs>(3), get<VendorBank>(4),
  ]);
  if (p.lat == null || !p.price || !p.address?.street) return 1;
  if (!(svc.count ?? svc.data.length)) return 2;
  if (!h?.availability?.length) return 3;
  if (!d?.IdProofFront || !d?.IdProofBack) return 4;
  if (!b?.account_number) return 5;
  return 6;
}

export default function Onboarding() {
  const router = useRouter();
  const { reload } = useVendor();
  const [screen, setScreen] = useState(0);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);

  const start = () => { setError(""); resume().then(setScreen).catch((e) => setError(e.message)); };
  useEffect(start, []);
  useEffect(() => { window.scrollTo(0, 0); document.querySelector<HTMLElement>("main h1")?.focus(); }, [screen]);

  async function logOut() {
    setLeaving(true);
    await api("vendor/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }
  async function finish() {
    setLeaving(true);
    await reload().catch(() => {});
    router.push("/");
  }

  const step = STEPS[screen - 1];
  const Form = step?.[2];
  return (
    <div className={s.page}>
      <header className={s.top}>
        <Logo />
        <button className="btn" onClick={logOut} disabled={leaving}>Log out</button>
      </header>
      <main className={s.main}>
        {error ? (
          <div className={s.done}>
            <p className="err" role="alert">{error}</p>
            <button className="btn p lg" onClick={start}>Try again</button>
          </div>
        ) : screen === 0 ? (
          <div className="skeleton" style={{ height: 320 }} aria-label="Loading" />
        ) : screen === 6 ? (
          <div className={s.done}>
            <CheckCircle size={56} weight="fill" className={s.tick} aria-hidden />
            <h1 tabIndex={-1}>You&apos;re all set up</h1>
            <p className="sub">Our team is reviewing your documents. Customers can book you once you&apos;re approved.</p>
            <button className="btn p lg" onClick={finish} disabled={leaving} aria-busy={leaving}>Go to Today</button>
          </div>
        ) : (
          <>
            <div className={s.progress}>
              <span>Step {screen} of 5</span>
              <progress max={5} value={screen} aria-hidden />
            </div>
            <h1 tabIndex={-1}>{step[0]}</h1>
            <p className={`sub ${s.sub}`}>{step[1]}</p>
            <Form key={screen} mode="onboarding" onDone={() => setScreen(screen + 1)} onBack={screen > 1 ? () => setScreen(screen - 1) : undefined} />
          </>
        )}
      </main>
    </div>
  );
}
