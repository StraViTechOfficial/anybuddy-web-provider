"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Job } from "@/lib/types";
import { JobDetail } from "../JobDetail";
import { tabOf } from "../bits";

// Phone and tablet job page (and notification links, which carry the slug). On a laptop it opens the split view.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState("requests");
  const onLoad = useCallback((j: Job) => {
    const t = tabOf(j.status);
    setTab(t);
    if (window.matchMedia("(min-width: 1021px)").matches) router.replace(`/jobs?tab=${t}&id=${j._id}`);
  }, [router]);
  return <JobDetail id={id} back={`/jobs?tab=${tab}`} onLoad={onLoad} />;
}
