"use client";
import { EditPage } from "@/components/forms/EditPage";
import { DocumentsForm } from "@/components/forms/DocumentsForm";

export default function Page() {
  return <EditPage title="Documents" sub="Our team reviews the documents every Buddy sends, to protect customers and keep trust." Form={DocumentsForm} />;
}
