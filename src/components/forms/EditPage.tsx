"use client";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react";
import { useToast } from "@/components/Toast";
import type { FormProps } from "./Field";
import s from "./forms.module.css";

// Account edit screens: the onboarding form in edit mode, "Saved" toast after each save. Title and form share one centred column;
// a top-level tab (no back link) uses the full content column so its title lines up with the logo like the other tabs.
export function EditPage({ title, sub, Form, back = true }: { title: string; sub: string; Form: (p: FormProps) => React.ReactNode; back?: boolean }) {
  const toast = useToast();
  return (
    <div className={back ? s.page : s.tab}>
      {back && <Link href="/account" className={s.back}><CaretLeft size={16} aria-hidden />Account</Link>}
      <h1>{title}</h1>
      <p className={`sub ${s.pageSub}`}>{sub}</p>
      <Form mode="edit" onDone={() => toast("Saved")} />
    </div>
  );
}
