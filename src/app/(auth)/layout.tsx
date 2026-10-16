import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import s from "./auth.module.css";

// Log in, sign up, code, forgot and reset show the logo, then one centred white card on a quiet grey page. There is no
// decorative band, because a black band looked like a sale banner. On phones the form sits straight on white.
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
