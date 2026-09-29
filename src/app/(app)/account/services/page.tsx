"use client";
import { EditPage } from "@/components/forms/EditPage";
import { ServicesEditor } from "@/components/forms/ServicesEditor";

export default function Page() {
  return <EditPage title="Services and rates" sub="Add each service you offer and its hourly rate. Customers book these." Form={ServicesEditor} />;
}
