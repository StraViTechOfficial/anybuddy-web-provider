"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Star } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { day } from "@/lib/format";
import { useVendor } from "@/components/Vendor";
import type { Review, Reviews, VendorExtra } from "@/lib/types";
import s from "../account.module.css";

const LIMIT = 20;
const Stars = ({ n }: { n: number }) => (
  <span className={s.stars} aria-label={`${n} of 5 stars`} role="img">
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} weight={i <= Math.round(n) ? "fill" : "regular"} aria-hidden />)}
  </span>
);

// What customers said after finished jobs, newest first.
export default function Page() {
  const { vendor } = useVendor();
  const slug = (vendor as VendorExtra | null)?.vendorSlug;
  const [data, setData] = useState<Reviews | null>(null);
  const [list, setList] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!vendor) return;
    if (!slug) { setData({ reviews: [], averageCount: 0, ratingCounts: { oneRating: 0, twoRating: 0, threeRating: 0, fourRating: 0, fiveRating: 0 } }); return; }
    api<Reviews>("user/services/list-rating-reviews", { query: { vendorSlug: slug, page, limit: LIMIT } }).then(
      (r) => { setData(r.data); setList((l) => (page === 1 ? r.data.reviews : [...l, ...r.data.reviews])); },
      (e: Error) => setError(e.message),
    );
  }, [vendor, slug, page]);

  const total = data ? Object.values(data.ratingCounts).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className={s.wrap}>
      <Link className={s.back} href="/account"><ArrowLeft size={20} aria-hidden />Account</Link>
      <h1>Reviews</h1>
      {error ? <p className="err" role="alert">{error}</p> : !data ? <div className={`skeleton ${s.loading}`} aria-label="Loading reviews" /> : total === 0 ? (
        <div className="box pad"><b>No reviews yet</b><p className="muted">Reviews from customers show up here after finished jobs.</p></div>
      ) : (
        <>
          <div className={`box pad ${s.avg}`}>
            <b>{data.averageCount.toFixed(1)}</b>
            <div><Stars n={data.averageCount} /><p className="muted">Average from {total} review{total === 1 ? "" : "s"}</p></div>
          </div>
          <ul className={`box ${s.reviews}`}>
            {list.map((r) => (
              <li key={r._id}>
                <div className={s.who}>
                  <b>{[r.userDetails.firstName, r.userDetails.lastName?.[0]].filter(Boolean).join(" ") || "Customer"}</b>
                  <span className="hint">{day(r.createdAt)}</span>
                </div>
                <Stars n={r.rating} />
                {r.feedBack && <p>{r.feedBack}</p>}
              </li>
            ))}
          </ul>
          {list.length < total && <div><button className="btn lg" onClick={() => setPage(page + 1)}>Show more reviews</button></div>}
        </>
      )}
    </div>
  );
}
