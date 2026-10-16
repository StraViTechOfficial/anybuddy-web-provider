"use client";
import { EditPage } from "@/components/forms/EditPage";
import { DocumentsForm } from "@/components/forms/DocumentsForm";

// A Get verified step, opened from Home. Save needs both sides of the ID and then returns to Home.
export default function Page() {
  return <EditPage home step="Step 3 of 3" title="Upload your ID" sub="Customers let you into their homes, so we check every Buddy." Form={DocumentsForm} />;
}
