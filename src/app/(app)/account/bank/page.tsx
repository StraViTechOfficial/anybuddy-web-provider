"use client";
import { EditPage } from "@/components/forms/EditPage";
import { BankForm } from "@/components/forms/BankForm";

export default function Page() {
  return <EditPage title="Bank details" sub="The bank account where your earnings are sent." Form={BankForm} />;
}
