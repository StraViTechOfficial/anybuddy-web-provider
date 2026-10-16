"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Briefcase, Clock, House, UserCircle, Wallet, type Icon } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { Logo } from "./Logo";
import { useVendor } from "./Vendor";
import s from "./Shell.module.css";

const TABS: [string, string, Icon][] = [
  ["/", "Home", House],
  ["/jobs", "Jobs", Briefcase],
  ["/hours", "Hours", Clock],
  ["/earnings", "Earnings", Wallet],
  ["/account", "Account", UserCircle],
];

// Phone: bottom tab bar. 700px and up: one top bar. Badges refresh every minute.
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { vendor } = useVendor();
  const [requests, setRequests] = useState(0);
  const [unread, setUnread] = useState(0);
  const approved = vendor?.verificationStatus === 1; // before approval only Home (review), Hours and Account
  useEffect(() => {
    if (!approved) return;
    const load = () => {
      api("vendor/bookings/list", { query: { status: 1, page: 1, limit: 1 } }).then((r) => setRequests(r.count ?? 0)).catch(() => {});
      // Opening Notifications marks everything read (backend), so the dot clears there.
      if (path === "/notifications") setUnread(0);
      else api("vendor/notification/list-unread", { method: "PUT" }).then((r) => setUnread(r.count ?? 0)).catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [path, approved]);
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const nav = TABS.filter(([href]) => approved || !["/jobs", "/earnings"].includes(href)).map(([href, label, I]) => (
    <Link key={href} href={href} aria-current={on(href) ? "page" : undefined}>
      <I size={20} weight={on(href) ? "fill" : "regular"} aria-hidden />
      {label}
      {href === "/jobs" && requests > 0 && <span className={s.n} aria-label={`${requests} requests`}>{requests}</span>}
    </Link>
  ));
  return (
    <div className={s.app}>
      <a href="#main" className="sr">Skip to content</a>
      <header className={s.top}>
        <Logo />
        <nav className={s.nav} aria-label="Main">{nav}</nav>
        {approved && <Link href="/notifications" className={s.bell} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell size={20} aria-hidden />
          {unread > 0 && <b />}
        </Link>}
      </header>
      {/* v3: the review banner lives on Home ("Get verified"); other screens only say when changes are needed. */}
      {vendor?.verificationStatus === 2 && path !== "/" && (
        <p className={`${s.banner} ${s.bad}`} role="status">
          Your application needs changes. <Link href="/account/help">Contact support</Link> to continue.
        </p>
      )}
      <main id="main" className={s.main}>{children}</main>
      <nav className={s.tabbar} aria-label="Main">{nav}</nav>
    </div>
  );
}
