"use client";
// Owner, search-first: typing searches services across every category (GET list-subcategories?search=, no categoryId);
// each result is "Service · Category" with Add, which adds it at once. No match: request the typed name as a new service.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SubCategory } from "@/lib/types";
import s from "./forms.module.css";

export function ServiceSearch({ added, onAdd, onRequest }: { added: Set<string>; onAdd: (x: SubCategory) => Promise<void>; onRequest: (text: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SubCategory[]>([]);
  const [none, setNone] = useState(false);
  const [adding, setAdding] = useState("");
  const asked = useRef("");

  useEffect(() => {
    const text = q.trim();
    setNone(false);
    if (!text) return setHits([]);
    const t = setTimeout(() => {
      asked.current = text;
      api<SubCategory[]>("vendor/services/list-subcategories", { query: { search: text } })
        .then((r) => { if (asked.current === text) { setHits(r.data); setNone(!r.data.length); } })
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function add(x: SubCategory) {
    setAdding(x._id);
    try { await onAdd(x); } finally { setAdding(""); }
  }

  return (
    <div className="field">
      <label className={s.label} htmlFor="svcSearch">Search services</label>
      <input id="svcSearch" className="input" type="search" autoComplete="off" placeholder="For example: toilet, shelves, lights"
        maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} aria-describedby="svcSearch-status" />
      <div id="svcSearch-status" role="status">
        {hits.length > 0 && (
          <ul className={`box ${s.list}`} aria-label="Matching services">
            {hits.map((x) => (
              <li key={x._id} className={`${s.item} ${s.hit}`}>
                <span>{x.serviceName}<span className="muted"> · {x.categoryName}</span></span>
                {added.has(x._id) ? <span className="tag t-ok">Added</span> : (
                  <button type="button" className="btn" onClick={() => add(x)} disabled={!!adding} aria-busy={adding === x._id}>
                    {adding === x._id ? <span className="spin" aria-hidden /> : "Add"}<span className="sr"> {x.serviceName}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {none && (
          <p className="hint">No service matches.{" "}
            <button type="button" className={s.link} onClick={() => onRequest(q.trim())}>Request &ldquo;{q.trim()}&rdquo;</button>
          </p>
        )}
      </div>
    </div>
  );
}
