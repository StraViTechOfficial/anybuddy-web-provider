import Link from "next/link";
import s from "./Logo.module.css";

// Buddy mark (the provider app icon, black) + wordmark. `compact` = mark only; `large` for sign-in and onboarding.
export function Logo({ compact = false, large = false }: { compact?: boolean; large?: boolean }) {
  const k = large ? 1.8 : 1;
  return (
    <Link href="/" className={s.logo} aria-label="Any-Buddy, home">
      <img src="/mark.png" alt="" width={Math.round(31 * k)} height={Math.round(34 * k)} />
      {!compact && <img className={s.word} src="/wordmark.png" alt="" width={Math.round(86 * k)} height={Math.round(18 * k)} />}
    </Link>
  );
}
