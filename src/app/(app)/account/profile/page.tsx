"use client";
import { EditPage } from "@/components/forms/EditPage";
import { ProfileForm } from "@/components/forms/ProfileForm";

export default function Page() {
  return <EditPage title="Profile" sub="Customers see this when they book you." Form={ProfileForm} />;
}
