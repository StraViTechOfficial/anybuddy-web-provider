"use client";
import { EditPage } from "@/components/forms/EditPage";
import { BankForm } from "@/components/forms/BankForm";

export default function Page() {
  return <EditPage title="Get paid" sub="Where we send your money after each job." Form={BankForm} />;
}
