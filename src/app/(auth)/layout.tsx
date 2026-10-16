import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import s from "./auth.module.css";

// Log in, sign up, code, forgot and reset: logo, then one centred white card on a quiet grey page.
// No decorative band (a black band read like a sale banner). Phones: form straight on white.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <header className={s.top}>
        <Logo large />
      </header>
      <main id="main" className={s.main}>
        <div className={s.card}>
          <Suspense>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
