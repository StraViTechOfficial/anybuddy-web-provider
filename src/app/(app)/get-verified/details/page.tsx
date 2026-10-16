"use client";
import { EditPage } from "@/components/forms/EditPage";
import { DetailsForm } from "@/components/forms/DetailsForm";

// A Get verified step, opened from Home.
export default function Page() {
  return <EditPage home step="Step 1 of 3" title="About you" sub="Takes about a minute." mode="onboarding" Form={DetailsForm} />;
}
