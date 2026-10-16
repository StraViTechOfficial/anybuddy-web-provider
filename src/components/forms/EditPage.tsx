"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { Onboarding } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useVendor } from "@/components/Vendor";
import type { FormProps, Mode } from "./Field";
import s from "./forms.module.css";

// Account edit screens: the onboarding form in edit mode, with a "Saved" toast after each save. The title and form
// share one centred column. A top-level tab (with no back link) uses the full content column, so its title lines up
// with the logo like the other tabs.
// `home` is for the "Get verified" editors: saving goes straight to the next unfilled step, then Home, and the back
// link goes Home.
// `to` makes the back link and saving return to that screen (Get paid's "Change" opens the name and address editor).
export function EditPage({ title, sub, Form, back = true, home = false, to, mode = "edit", step }: {
  title: string; sub: string; step?: string; Form: (p: FormProps) => React.ReactNode; back?: boolean; home?: boolean; to?: { href: string; label: string }; mode?: Mode;
}) {
  const toast = useToast();
  const router = useRouter();
  const { reload } = useVendor();
  const done = to
    ? async () => { await reload().catch(() => {}); toast("Saved"); router.push(to.href); }
    : home
    ? async () => {
        const next = await api<Onboarding>("vendor/auth/onboarding").then((r) => r.data.verify?.next, () => null);
        await reload().catch(() => {});
        toast("Saved");
        router.push(next && !location.pathname.endsWith(`/${next}`) ? `/get-verified/${next}` : "/");
      }
    : () => toast("Saved");
  return (
    <div className={back ? s.page : s.tab}>
      {back && <Link href={to?.href ?? (home ? "/" : "/account")} className={s.back}><CaretLeft size={16} aria-hidden />{to?.label ?? (home ? "Home" : "Account")}</Link>}
      {step && <p className="hint">{step}</p>}
      <h1>{title}</h1>
      <p className={`sub ${s.pageSub}`}>{sub}</p>
      <Form mode={mode} onDone={done} />
    </div>
  );
}
