"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { day, time } from "@/lib/format";
import type { Notice } from "@/lib/types";
import s from "./notifications.module.css";

const LIMIT = 20;

// Newest first. Opening this list marks everything read on the server; a row still shows "New" if it was unread.
export default function Page() {
  const [items, setItems] = useState<Notice[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (p: number) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api<Notice[]>("vendor/notification/list", { query: { page: p, limit: LIMIT } });
      setItems((old) => (p === 1 ? data : [...(old ?? []), ...data]));
      setPage(p);
      setMore(data.length === LIMIT); // `count` is this page's length, so a full page means there may be more
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(1); }, [load]);

  const body = (n: Notice) => (
    <>
      <span className={s.text}>
        <b>{n.read_status === 0 && <span className={s.new}>New</span>}{n.title}</b>
        {n.message && <span>{n.message}</span>}
        <small>{day(n.createdAt)}, {time(n.createdAt)}</small>
      </span>
      {n.bookingSlug && <CaretRight size={20} aria-hidden className="muted" />}
    </>
  );

  return (
    <div className={s.col}>
      <h1>Notifications</h1>
      <div className={`box ${s.list}`} role="list" aria-busy={items === null}>
        {items === null && !error && [0, 1, 2].map((i) => <div key={i} className={`skeleton ${s.ghost}`} />)}
        {items?.length === 0 && <p className="pad muted">You&apos;re all caught up.</p>}
        {items?.map((n) => (
          <div key={n._id} role="listitem">
            {n.bookingSlug
              ? <Link className={s.row} href={`/jobs/${n.bookingSlug}`} aria-label={`${n.title}. View job`}>{body(n)}</Link>
              : <div className={s.row}>{body(n)}</div>}
          </div>
        ))}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {more && (
        <button className={`btn block ${s.more}`} onClick={() => load(page + 1)} aria-busy={busy} disabled={busy}>Load more</button>
      )}
    </div>
  );
}
