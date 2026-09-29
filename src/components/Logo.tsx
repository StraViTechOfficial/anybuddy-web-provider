import Link from "next/link";
import s from "./Logo.module.css";

// Buddy mark (the provider app icon) + wordmark + PRO. `compact` = mark + PRO only (phones).
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={s.logo} aria-label="Any-Buddy Pro, home">
      <img src="/mark.png" alt="" width={34} height={34} />
      {!compact && <img className={s.word} src="/wordmark.png" alt="" height={18} />}
      <span className={s.pro}>PRO</span>
    </Link>
  );
}
