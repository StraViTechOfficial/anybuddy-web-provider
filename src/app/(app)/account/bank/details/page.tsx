"use client";
import { EditPage } from "@/components/forms/EditPage";
import { DetailsForm } from "@/components/forms/DetailsForm";

// Get paid › "Change": the name-and-address editor, back to Get paid when saved.
export default function Page() {
  return <EditPage to={{ href: "/account/bank", label: "Get paid" }} title="Your name and address" sub="Your name, where you live and how far you travel." Form={DetailsForm} />;
}
