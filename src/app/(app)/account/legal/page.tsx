"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import s from "../account.module.css";

const DOCS = { terms: ["Terms of use", 2], privacy: ["Privacy policy", 3] } as const; // the type for user/cms/list: 2 is the Terms, 3 is the Privacy Policy
type Doc = keyof typeof DOCS;

/** CMS pages are HTML written by an admin. This keeps the text and structure and drops anything that could run code
 *  or load something. */
function clean(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, iframe, object, embed, form, link, meta, img, svg").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((n) => {
    for (const a of [...n.attributes]) {
      if (a.name.startsWith("on") || a.name === "style" || a.name === "class") n.removeAttribute(a.name);
      else if (a.name === "href" && !/^(https?:|mailto:|#)/i.test(a.value.trim())) n.removeAttribute(a.name);
    }
    // Links to a section of this page (#section) stay in the tab. Links to other sites open a new tab.
    if (n.tagName === "A" && !n.getAttribute("href")?.startsWith("#")) { n.setAttribute("target", "_blank"); n.setAttribute("rel", "noopener noreferrer"); }
  });
  // The page already has its h1, so the document's own headings move down one level.
  doc.querySelectorAll("h1").forEach((h) => { const h2 = doc.createElement("h2"); h2.innerHTML = h.innerHTML; h.replaceWith(h2); });
  return doc.body.innerHTML;
}

function Legal() {
  const q = useSearchParams().get("doc");
  const doc: Doc = q === "privacy" ? "privacy" : "terms";
  const [html, setHtml] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (html[doc]) return;
    setError("");
    api<{ content: string }>("user/cms/list", { query: { type: DOCS[doc][1] } }).then(
      (r) => setHtml((h) => ({ ...h, [doc]: clean(r.data.content) })),
      (e: Error) => setError(e.message),
    );
  }, [doc, html]);

  return (
    <div className={s.wrap}>
      <Link className={s.back} href="/account"><ArrowLeft size={20} aria-hidden />Account</Link>
      <h1>Terms and privacy</h1>
      <nav className={s.tabs} aria-label="Documents">
        {(Object.keys(DOCS) as Doc[]).map((k) => (
          <Link key={k} href={`?doc=${k}`} replace scroll={false} aria-current={k === doc ? "page" : undefined}>{DOCS[k][0]}</Link>
        ))}
      </nav>
      {error ? (
        <p className="err" role="alert">{error} Read it on <a href="https://www.any-buddy.com" target="_blank" rel="noopener noreferrer">any-buddy.com</a>.</p>
      ) : html[doc] ? (
        <article className={`box pad ${s.doc}`} aria-label={DOCS[doc][0]} dangerouslySetInnerHTML={{ __html: html[doc] }} />
      ) : <div className={`skeleton ${s.loading}`} aria-label="Loading" />}
      <p className="hint">Also on <a href="https://www.any-buddy.com" target="_blank" rel="noopener noreferrer">www.any-buddy.com</a>.</p>
    </div>
  );
}

export default function Page() {
  return <Suspense><Legal /></Suspense>;
}
