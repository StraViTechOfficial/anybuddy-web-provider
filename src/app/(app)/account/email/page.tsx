"use client";
import { EditPage } from "@/components/forms/EditPage";
import { EmailForm } from "@/components/forms/EmailForm";

export default function Page() {
  return <EditPage title="Email" sub="Optional. For logging in without your phone, payout change codes and the updates you choose." Form={EmailForm} />;
}
