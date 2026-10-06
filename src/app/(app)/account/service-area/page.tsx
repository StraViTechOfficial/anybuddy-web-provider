"use client";
import { EditPage } from "@/components/forms/EditPage";
import { ServiceAreaForm } from "@/components/forms/ServiceAreaForm";

export default function Page() {
  return <EditPage title="Service area" sub="How far you travel from home. Customers see your city and this distance, never your street." Form={ServiceAreaForm} />;
}
