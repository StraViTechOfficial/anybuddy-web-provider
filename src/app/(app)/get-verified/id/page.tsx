"use client";
import { EditPage } from "@/components/forms/EditPage";
import { DocumentsForm } from "@/components/forms/DocumentsForm";

// v3 Get verified, opened from Home: Save needs both sides, then back to Home.
export default function Page() {
  return <EditPage home step="Step 3 of 3" title="Upload your ID" sub="Customers let you into their homes, so we check every Buddy." Form={DocumentsForm} />;
}
