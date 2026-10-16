"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock, CurrencyDollar, Lifebuoy, MapPin, Star } from "@phosphor-icons/react";
import { JobActions } from "@/components/job/JobActions";
import { Earn } from "@/components/job/Earn";
import { api } from "@/lib/api";
import { clock, day } from "@/lib/format";
import type { Job } from "@/lib/types";
import { hours, service } from "./bits";
import s from "./jobs.module.css";

const PAID: Record<number, string> = { 0: "payment pending", 1: "payment processing", 2: "paid", 3: "payment canceled", 4: "refunded" };

// One job: what, when, where, who, the money, proof photos, the customer's review, and the next action (JobActions).
// `id` is the booking _id or its slug, because notification links carry the slug.
// `embedded` means the job is shown beside the list on a laptop, where the page already has its h1 ("Jobs").
export function JobDetail({ id, back, onChange, onLoad, embedded = false }: { id: string; back: string; onChange?: () => void; onLoad?: (j: Job) => void; embedded?: boolean }) {
  const Title = embedded ? "h2" : "h1";
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Job>("vendor/bookings/detail", { query: { bookingId: id } })
      .then((r) => { setJob(r.data); onLoad?.(r.data); })
      .catch((e) => setError(e.message));
  }, [id, onLoad]);
  useEffect(load, [load]);

  const backLink = <Link className={s.back} href={back}><ArrowLeft size={20} aria-hidden />Jobs</Link>;
  if (error) return <>{backLink}<p className="box pad err" role="alert">{error}</p></>;
  if (!job) return <>{backLink}<div className={`skeleton ${s.ghostBig}`} aria-busy /></>;

  const u = job.user_details ?? {};
  const photos = [...(job.checkInImages ?? []), ...(job.checkOutImages ?? [])].filter((p) => p.url);

  // While a job is open (a request or confirmed), JobActions shows the status, when and where, and the customer's note.
  // It also shows Call and Directions, time worked, earnings and the cancel reason. This page shows the rest, so
  // nothing appears twice.
  const open = job.status === 1 || job.status === 2;
  return (
    <>
      {backLink}
      <article className="box pad">
        <Title className={s.title}>{service(job)}</Title>
        {job.categoryName && <p className="muted">{job.categoryName}</p>}

        <ul className={s.meta}>
          {!open && (
            <li><Clock size={20} aria-hidden />{day(job.scheduledDate)}{job.selectedSlot && `, ${clock(job.selectedSlot)}`}{job.endTime && ` to ${clock(job.endTime)}`}, {hours(job)}</li>
          )}
          {!open && job.address && <li><MapPin size={20} aria-hidden />{job.address}</li>}
          {job.endAddress && <li><MapPin size={20} aria-hidden />Then to {job.endAddress}</li>}
          <li><CurrencyDollar size={20} aria-hidden />{hours(job)} booked, {PAID[job.payment_status ?? 0]}</li>
        </ul>
        {job.status === 2 && <Earn b={job} />}

        <div className={s.actions}>
          <JobActions booking={job} onChange={() => { load(); onChange?.(); }} />
        </div>

        <dl className={s.kv}>
          <div><dt>Customer</dt><dd>{u.firstName || "Customer"}</dd></div>
          {!open && job.userDesc && <div><dt>Note</dt><dd>{job.userDesc}</dd></div>}
          {job.bookingId && <div><dt>Job #</dt><dd>{job.bookingId}</dd></div>}
        </dl>

        {job.rating != null && (
          <section className={s.section} aria-label="Customer review">
            <h2>Customer review</h2>
            <p className={s.stars} aria-label={`${job.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={20} weight={n <= (job.rating ?? 0) ? "fill" : "regular"} aria-hidden />)}
            </p>
            {job.feedBack && <p>{job.feedBack}</p>}
          </section>
        )}

        {photos.length > 0 && (
          <section className={s.section}>
            <h2>Photos</h2>
            <div className={s.photos}>
              {photos.map((p, i) => (
                <a key={p.url + i} href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- job photos come from S3 and don't go through an image optimiser */}
                  <img src={p.url} alt={`Job photo ${i + 1}`} loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}

        <Link className={`btn ${s.help}`} href={`/account/help?booking=${job.bookingId || job._id}`}>
          <Lifebuoy size={20} aria-hidden />Get help with this job
        </Link>
      </article>
    </>
  );
}
