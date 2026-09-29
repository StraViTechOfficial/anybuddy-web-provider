"use client";
import { EditPage } from "@/components/forms/EditPage";
import { HoursEditor } from "@/components/forms/HoursEditor";

export default function Page() {
  return <EditPage title="Working hours" sub="Customers can only book you inside these hours" back={false} Form={HoursEditor} />;
}
