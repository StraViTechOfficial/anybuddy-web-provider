"use client";
import { EditPage } from "@/components/forms/EditPage";
import { DetailsForm } from "@/components/forms/DetailsForm";

// The name and address editor that "Change" opens on Get paid. Saving returns to Get paid.
export default function Page() {
  return <EditPage to={{ href: "/account/bank", label: "Get paid" }} title="Your name and address" sub="Your name, where you live and how far you travel." Form={DetailsForm} />;
}
