"use client";
import { EditPage } from "@/components/forms/EditPage";
import { ServicesEditor } from "@/components/forms/ServicesEditor";

// A Get verified step, opened from Home. Continue needs at least one service and then returns to Home.
export default function Page() {
  return <EditPage home step="Step 2 of 3" mode="onboarding" title="Services and rates" sub="Add each service you offer and its hourly rate. Customers book these." Form={ServicesEditor} />;
}
