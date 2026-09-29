"use client";
import { useEffect, useState } from "react";
import { CheckCircle, Lifebuoy, MapTrifold, NavigationArrow, Phone, Warning } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { countdown, elapsed, money, cancelLabel } from "@/lib/format";
import type { Booking, JobBooking } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { CodeStep } from "./CodeStep";
import { Reason } from "./Reason";
import { Slide } from "./Slide";
import { Fit } from "./Fit";
import { bookedHours, dayLabel, hm, minuteOf, msUntil, slotMin, useNow, ymd } from "./when";
import s from "./JobActions.module.css";

type Mode = null | "decline" | "eta" | "code" | "cancel";
const ETAS = [5, 10, 15, 30, 45, 60];
const oops = (x: unknown) => (x instanceof ApiError ? x.message : "Something went wrong. Try again.");

// The whole action area for one booking in any state (Home focus panel and the Jobs detail page).
export function JobActions({ booking, onChange }: { booking: Booking; onChange: () => void }) {
  const b = booking as JobBooking;
  const toast = useToast();
  const now = useNow();
  const [open, setOpen] = useState<{ id: string; mode: Mode }>({ id: "", mode: null });
  const mode = open.id === b._id ? open.mode : null;
  const to = (m: Mode) => setOpen({ id: b._id, mode: m });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // One call, then refresh; `next` is the panel to show after it (null closes panels).
  const run = async (fn: () => Promise<unknown>, done?: string, next: Mode = null) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      if (done) toast(done);
      to(next);
      if (!next) onChange();
    } catch (x) {
      setErr(oops(x));
      onChange(); // e.g. "cancelled, but refund failed": the booking still changed
    }
    setBusy(false);
  };
  // Reason forms show their own error; refresh either way for the same reason.
  const settle = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast(done);
      to(null);
    } catch (x) {
      toast(oops(x)); // stays visible if the refresh closes this panel
      throw x;
    } finally {
      onChange();
    }
  };

  const start = slotMin(b.selectedSlot), hrs = bookedHours(b), hrsText = `${hrs} hr${hrs > 1 ? "s" : ""}`;
  const today = ymd(now), day = ymd(b.scheduledDate);
  const errLine = err && <p className="err" role="alert">{err}</p>;

  /* ---------- request ---------- */
  if (b.status === 1) {
    const left = b.expiresAt ? Date.parse(b.expiresAt) - now.getTime() : null;
    return (
      <div className={s.wrap}>
        <span className="tag t-wait">{left === null ? "Request" : left > 0 ? `Request, expires in ${countdown(left)}` : "Request expired"}</span>
        <dl className={s.kv}>
          <dt>When</dt><dd>{dayLabel(day)}, {hm(start)} to {hm(start + hrs * 60)}</dd>
          {b.address && <><dt>Where</dt><dd>{b.address}</dd></>}
          <dt>Pays</dt><dd>{money(b.vendorPriceAfterDetection ?? b.price)} to you, already paid by the customer</dd>
        </dl>
        <Fit b={b} />
        {mode === "decline" ? (
          <Reason
            confirm="Decline request"
            onClose={() => to(null)}
            onSubmit={(message) => settle(() => api("vendor/bookings/update-status", { method: "PUT", body: { bookingId: b._id, status: 4, message } }), "Declined. The customer gets a full refund.")}
          />
        ) : (
          <div className={s.row}>
            <button className="btn p lg" data-key="a" disabled={busy} aria-busy={busy}
              onClick={() => run(() => api("vendor/bookings/update-status", { method: "PUT", body: { bookingId: b._id, status: 2 } }), "Accepted. The job is on your schedule.")}>
              Accept <kbd>A</kbd>
            </button>
            <button className="btn lg" data-key="d" onClick={() => to("decline")}>Decline <kbd>D</kbd></button>
          </div>
        )}
        {errLine}
      </div>
    );
  }

  /* ---------- finished or cancelled ---------- */
  if (b.status === 3) {
    const worked = b.checkInAt && b.checkOutAt ? Date.parse(b.checkOutAt) - Date.parse(b.checkInAt) : null;
    return (
      <div className={s.wrap}>
        <span className="tag t-ok">Done</span>
        <Ring p={1} tone="done" big={worked === null ? "Done" : elapsed(worked)} small={worked === null ? "finished" : "worked"} />
        <p className={`${s.fit} ${s.ok}`}>
          <CheckCircle size={20} weight="fill" aria-hidden />
          <span>
            Finished.{b.hoursBilled ? ` Billed ${b.hoursBilled} of ${hrsText} booked.` : ""}
            {b.vendorPriceAfterDetection != null && ` ${money(b.vendorPriceAfterDetection)} added to your balance.`}
          </span>
        </p>
      </div>
    );
  }
  if (b.status === 4) {
    return (
      <div className={s.wrap}>
        <span className="tag t-bad">Canceled</span>
        <p>{cancelLabel(b)}.{typeof b.cancelReason === "string" && b.cancelReason ? ` Reason: ${b.cancelReason}` : ""}</p>
      </div>
    );
  }

  /* ---------- confirmed or in progress ---------- */
  const phone = b.user_details?.phone;
  const contact = (phone || b.address) && (
    <div className={s.row}>
      {phone && <a className="btn lg" href={`tel:${b.user_details?.countryCode || "+1"}${phone}`}><Phone size={20} aria-hidden />Call</a>}
      {b.address && (
        <a className="btn lg" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address)}`}>
          <MapTrifold size={20} aria-hidden />Directions
        </a>
      )}
    </div>
  );
  // Sliding sends the code to the customer, then the code boxes open.
  const sendCode = () => run(() => api("vendor/bookings/send-code", { method: "PUT", body: { bookingId: b._id } }), undefined, "code");
  const code = <CodeStep bookingId={b._id} finish={!!b.checkInAt} onClose={() => to(null)} onDone={() => { to(null); onChange(); }} />;

  // Mid-job order (owner 29 Sep): live status, timer, finish, the customer's note, then call / help. No directions: already there.
  if (b.checkInAt) {
    const since = now.getTime() - Date.parse(b.checkInAt);
    const started = minuteOf(new Date(b.checkInAt));
    return (
      <div className={s.wrap}>
        <p className={s.live}><i aria-hidden />In progress, started {hm(started)}. Booked until {hm(started + hrs * 60)}.</p>
        <Ring p={Math.min(1, since / (hrs * 36e5))} tone={mode === "code" ? "wait" : ""} big={elapsed(since)} small={`of ${hrsText} booked`} />
        {mode === "code" ? code : <Slide label="Slide to finish the job" busy={busy} onDone={sendCode} />}
        {errLine}
        {typeof b.userDesc === "string" && b.userDesc && <p className={s.note}><b>Customer note</b>{b.userDesc}</p>}
        <div className={s.row}>
          {phone && <a className="btn" href={`tel:${b.user_details?.countryCode || "+1"}${phone}`}><Phone size={20} aria-hidden />Call customer</a>}
          <a className="btn" href={`/account/help?booking=${encodeURIComponent(String(b.bookingId ?? b._id))}`}><Lifebuoy size={20} aria-hidden />Get help</a>
        </div>
      </div>
    );
  }

  const cancel = mode === "cancel"
    ? <CancelJob id={b._id} onClose={() => to(null)} onSubmit={(reason) => settle(() => api("vendor/bookings/cancel", { method: "PUT", body: { bookingId: b._id, reason } }), "Job canceled. The customer gets a full refund.")} />
    : <button className={`btn lg ${s.quiet}`} onClick={() => to("cancel")}>Cancel job</button>;

  if (day > today) {
    return (
      <div className={s.wrap}>
        <span className="tag t-info">Confirmed</span>
        {contact}
        <Ring p={0} big={hm(start)} small={dayLabel(day)} />
        <p className={`hint ${s.center}`}>The next steps open on the day of the job.</p>
        {cancel}
      </div>
    );
  }

  const until = msUntil(b, now);
  const eta = b.onTheWayAt && b.etaMinutes ? new Date(Date.parse(b.onTheWayAt) + b.etaMinutes * 6e4) : null;
  const when = eta ? `Arriving by ${hm(minuteOf(eta))}` : until > 0 ? `Starts in ${countdown(until)}` : "Due now";
  return (
    <div className={s.wrap}>
      <span className={`tag ${eta ? "t-wait" : "t-info"}`}>{eta ? `On the way, ${b.etaMinutes} min` : "Confirmed"}</span>
      {contact}
      <Ring p={0} tone={mode === "code" ? "wait" : ""} big={hm(start)} small={when} />
      {mode === "code" ? code : (
        <>
          {!b.onTheWayAt && mode !== "eta" && (
            <button className={`btn lg ${s.wide}`} onClick={() => to("eta")}>
              <NavigationArrow size={20} aria-hidden />On my way <span className={s.opt}>Optional</span>
            </button>
          )}
          {mode === "eta" && (
            <Eta busy={busy} onClose={() => to(null)}
              onSend={(m) => run(() => api("vendor/bookings/on-the-way", { method: "PUT", body: { bookingId: b._id, etaMinutes: m } }), `Sent. The customer knows you arrive in ${m} min.`)} />
          )}
          <Slide label="Slide to start the job" busy={busy} onDone={sendCode} />
        </>
      )}
      {errLine}
      {mode !== "code" && cancel}
    </div>
  );
}

function Ring({ p, big, small, tone = "" }: { p: number; big: string; small: string; tone?: "" | "wait" | "done" }) {
  const C = 2 * Math.PI * 52;
  return (
    <div className={`${s.ring} ${tone ? s[tone] : ""}`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="52" className={s.rt} />
        <circle cx="60" cy="60" r="52" className={s.rp} style={{ strokeDasharray: C, strokeDashoffset: C * (1 - p) }} />
      </svg>
      <div className={s.rtxt}><b>{big}</b><small>{small}</small></div>
    </div>
  );
}

function Eta({ onSend, onClose, busy }: { onSend: (m: number) => void; onClose: () => void; busy: boolean }) {
  const [m, setM] = useState(15);
  return (
    <div className={s.panel}>
      <span className={s.lbl} id="eta-l">Arriving in</span>
      <div className={s.chips} role="group" aria-labelledby="eta-l">
        {ETAS.map((x) => <button key={x} type="button" aria-pressed={m === x} onClick={() => setM(x)}>{x} min</button>)}
      </div>
      <div className={s.row}>
        <button className="btn p lg" disabled={busy} aria-busy={busy} onClick={() => onSend(m)}>Tell the customer</button>
        <button className="btn lg" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function CancelJob({ id, onClose, onSubmit }: { id: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [terms, setTerms] = useState<{ refundToCustomer: number; feeDeduction: number } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ refundToCustomer: number; feeDeduction: number }>("vendor/bookings/cancel-preview", { query: { bookingId: id } })
      .then((r) => setTerms(r.data))
      .catch((x) => setErr(oops(x)));
  }, [id]);
  if (err) return <p className="err" role="alert">{err}</p>;
  if (!terms) return <div className="skeleton" style={{ height: 44 }} />;
  const fee = terms.feeDeduction > 0 ? `${money(terms.feeDeduction)} card fee is taken off your balance.` : "No fee is taken off your balance.";
  return (
    <Reason
      intro={<p className={`${s.fit} ${s.warn}`}><Warning size={20} aria-hidden /><span>Full refund to the customer. {fee}</span></p>}
      confirm="Cancel job"
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
