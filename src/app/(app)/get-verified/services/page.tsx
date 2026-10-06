"use client";
import { EditPage } from "@/components/forms/EditPage";
import { ServicesEditor } from "@/components/forms/ServicesEditor";

// v3 Get verified, opened from Home: Continue (needs one service) goes back to Home.
export default function Page() {
  return <EditPage home step="Step 2 of 3" mode="onboarding" title="Services and rates" sub="Add each service you offer and its hourly rate. Customers book these." Form={ServicesEditor} />;
}
