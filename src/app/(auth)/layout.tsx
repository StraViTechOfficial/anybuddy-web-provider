import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import s from "./auth.module.css";

// Log in, sign up, code, forgot and reset: one centred card over an angled navy band (WEBSITE-STANDARD auth row).
// Top of the page stays white so the full-color logo reads cleanly. Phones: slim band, form straight on white.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <div className={s.band} aria-hidden />
      <header className={s.top}>
        <Logo />
      </header>
      <main id="main" className={s.main}>
        <div className={s.card}>
          <Suspense>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
