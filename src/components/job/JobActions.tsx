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
import { Earn, PayoutLine } from "./Earn";
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
  const note = typeof b.userDesc === "string" && b.userDesc ? <p className={s.note}><b>Customer note</b>{b.userDesc}</p> : null;

  /* ---------- request ---------- */
  if (b.status === 1) {
    const left = b.expiresAt ? Date.parse(b.expiresAt) - now.getTime() : null;
    return (
      <div className={s.wrap}>
        <span className="tag t-wait">{left === null ? "Request" : left > 0 ? `Request, expires in ${countdown(left)}` : "Request expired"}</span>
        <dl className={s.kv}>
          <dt>When</dt><dd>{dayLabel(day)}, {hm(start)} to {hm(start + hrs * 60)}</dd>
          {b.address && <><dt>Where</dt><dd>{b.address}</dd></>}
        </dl>
        <Earn b={b} />
        {b.payment_status === 2 && <p className="hint">Customer has paid. You&apos;re paid after the job.</p>}
        {note}
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
        <p className={`${s.fit} ${s.ok}`}>
          <CheckCircle size={20} weight="fill" aria-hidden />
          <span>
            Finished.{worked !== null && ` Worked ${worked < 6e4 ? "less than a minute" : elapsed(worked)}.`}{b.hoursBilled ? ` Billed ${b.hoursBilled} of ${hrsText} booked.` : ""}
          </span>
        </p>
        <Earn b={b} />
        <PayoutLine b={b} />
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
  const facts = (whenText: string) => (
    <dl className={s.kv}>
      <dt>When</dt><dd>{whenText}, {hm(start)} to {hm(start + hrs * 60)}</dd>
      {b.address && <><dt>Where</dt><dd>{b.address}</dd></>}
    </dl>
  );
  // Sliding sends the code to the customer, then the code boxes open.
  const sendCode = () => run(() => api("vendor/bookings/send-code", { method: "PUT", body: { bookingId: b._id } }), undefined, "code");
  const code = <CodeStep bookingId={b._id} finish={!!b.checkInAt} onClose={() => to(null)} onDone={() => { to(null); onChange(); }} />;

  // Mid-job order: live status, time worked (a thin bar, not the centre of the screen), finish, the
// customer's note, then call / help. No directions: already there.
  if (b.checkInAt) {
    const since = now.getTime() - Date.parse(b.checkInAt);
    const started = minuteOf(new Date(b.checkInAt));
    return (
      <div className={s.wrap}>
        <p className={s.live}><i aria-hidden />In progress, started {hm(started)}. Booked until {hm(started + hrs * 60)}.</p>
        <Progress since={since} booked={hrs * 36e5} label={`of ${hrsText} booked`} />
        {mode === "code" ? code : <Slide label="Slide to finish the job" busy={busy} onDone={sendCode} />}
        {errLine}
        {note}
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

  // On my way and Start are open any day once the job is confirmed (Buddies can go early).
  const until = msUntil(b, now);
  const eta = b.onTheWayAt && b.etaMinutes ? new Date(Date.parse(b.onTheWayAt) + b.etaMinutes * 6e4) : null;
  const sendEta = (m: number) => run(() => api("vendor/bookings/on-the-way", { method: "PUT", body: { bookingId: b._id, etaMinutes: m } }), `Sent. The customer knows you arrive in ${m} min.`);
  return (
    <div className={s.wrap}>
      <span className={`tag ${eta ? "t-wait" : "t-info"}`}>{eta ? `On the way, arriving by ${hm(minuteOf(eta))}` : "Confirmed"}</span>
      {facts(day > today ? dayLabel(day) : until > 0 ? `Today, in ${countdown(until)}` : "Today, due now")}
      {contact}
      {note}
      {mode === "code" ? code : (
        <>
          {/* One tap sends. A wrong tap is fixed by another: the server takes a new time and tells the customer again. */}
          {eta && mode !== "eta" ? (
            <p className={s.sent}>
              <NavigationArrow size={20} aria-hidden />The customer knows you arrive by {hm(minuteOf(eta))}.
              <button type="button" className={s.link} onClick={() => to("eta")}>Change</button>
            </p>
          ) : (
            <div className={s.eta} role="group" aria-labelledby="eta-l">
              <span className={s.lbl} id="eta-l">On my way, arriving in <span className={s.opt}>Optional</span></span>
              <div className={s.chips}>
                {ETAS.map((x) => (
                  <button key={x} type="button" disabled={busy} aria-pressed={b.etaMinutes === x && !!eta} onClick={() => sendEta(x)}>{x} min</button>
                ))}
              </div>
            </div>
          )}
          <Slide label="Slide to start the job" busy={busy} onDone={sendCode} />
        </>
      )}
      {errLine}
      {mode !== "code" && cancel}
    </div>
  );
}

/** Time worked on a thin bar; past the booked time the bar turns amber and says by how much. */
function Progress({ since, booked, label }: { since: number; booked: number; label: string }) {
  const over = since - booked;
  return (
    <div className={`${s.prog} ${over > 6e4 ? s.over : ""}`}>
      <p><b>{elapsed(since)}</b> <span>{over > 6e4 ? `${countdown(over)} over the booked time` : label}</span></p>
      <div className={s.bar} aria-hidden><i style={{ width: `${Math.min(100, (since / booked) * 100)}%` }} /></div>
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
