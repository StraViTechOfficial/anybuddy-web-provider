"use client";
import { CheckCircle } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import Link from "next/link";
import { age, needs, NEEDS_LEAD, parseDob, SUPPORT_LEAD } from "@/lib/pay";
import { loadStripe, payoutAccount, token } from "@/lib/stripe";
import type { PayoutAccount, VendorProfile } from "@/lib/types";
import { validAba } from "./BankForm";
import { Actions, Field, RequiredNote, SelectField, errText, hasErrors, type Errors, type FormProps } from "./Field";
import { StripeAsks } from "./StripeAsks";
import s from "./forms.module.css";

type State = { name: string; isoCode: string };
const EMPTY = {
  first: "", last: "", dob: "", ssn: "", phone: "", line1: "", line2: "", city: "", state: "", zip: "",
  holder: "", routing: "", account: "", confirm: "", password: "",
  // Paid through a business: the business, and the Buddy's email and title as its representative.
  bname: "", ein: "", structure: "", bphone: "", bline1: "", bline2: "", bcity: "", bstate: "", bzip: "", email: "", title: "",
};
type Kind = "individual" | "company";
const STRUCTURES = [
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "single_member_llc", label: "Single-member LLC" },
  { value: "multi_member_llc", label: "Multi-member LLC" },
  { value: "private_corporation", label: "Corporation" },
];
const KINDS: [Kind, string][] = [["individual", "Individual — paid with your SSN or ITIN"], ["company", "Business — paid through your company's EIN"]];
const einText = (d: string) => (d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d);
// Same words as the iOS app (Payouts.statusRows). Pending and verified have their own boxes below.
const STATUS: Record<"needs_info" | "disabled", [string, string, string]> = {
  needs_info: ["Needs info", "t-bad", NEEDS_LEAD],
  disabled: ["Disabled", "t-bad", "Payouts are paused on this account. Contact support to turn them back on."],
};
// After a save Stripe checks in the background; GET vendor/payouts/account re-checks with Stripe on each call.
const POLL_MS = 3000, POLL_FOR_MS = 60000;
const waiting = (st?: PayoutAccount["status"]) => st === "pending" || st === "not_started";

// Account › Bank and onboarding step 5 in Stripe mode (contract 30 Sep). Bank numbers go straight from this page to
// Stripe as a token; our server gets the token, the identity US law asks for, and the Buddy's consent. The saved bank
// shows only as its last 4; changing it needs the password (server rule).
export function StripeBankForm({ mode, onDone, onBack, pk }: FormProps & { pk: string }) {
  const [v, setV] = useState(EMPTY);
  const [acct, setAcct] = useState<PayoutAccount | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<Kind>("individual");
  const [switchNote, setSwitchNote] = useState(false);
  const [einFocus, setEinFocus] = useState(false);
  const [poll, setPoll] = useState(0); // bumped to start a 60 s round of checks
  const [slow, setSlow] = useState(false); // the round ended with Stripe still checking
  const toast = useToast();

  useEffect(() => {
    if (!poll) return;
    let gone = false, t: ReturnType<typeof setTimeout>;
    const end = Date.now() + POLL_FOR_MS;
    const tick = async () => {
      const a = await payoutAccount().catch(() => null); // a failed check just waits for the next one
      if (gone) return;
      if (a) setAcct(a);
      if (a && !waiting(a.status)) return void (a.status === "verified" && toast("Payout details saved"));
      if (Date.now() >= end) return setSlow(true);
      t = setTimeout(tick, POLL_MS);
    };
    setSlow(false);
    t = setTimeout(tick, POLL_MS);
    return () => { gone = true; clearTimeout(t); };
  }, [poll, toast]);

  useEffect(() => {
    api<State[]>("list-location", { query: { country: "United States" } })
      .then((r) => setStates(r.data.filter((x) => /^[A-Z]{2}$/.test(x.isoCode))))
      .catch(() => {});
    // Prefill from what Stripe has (identity: never the DOB or SSN), else the profile; the Buddy checks it.
    Promise.all([payoutAccount(), api<VendorProfile>("vendor/auth/get-profile-details", { query: { type: 1 } })])
      .then(([a, { data: p }]) => {
        setAcct(a);
        if (a.status === "pending") setPoll((n) => n + 1);
        setKind(a.type ?? "individual");
        const id = a.identity, ad = id?.address, b = a.business, ba = b?.address;
        setV((o) => ({
          ...o, first: id?.firstName || p.firstName || "", last: id?.lastName || p.lastName || "",
          phone: (id?.phone || p.phone || "").replace(/\D/g, "").slice(-10),
          line1: ad?.line1 || p.address?.street || "", line2: ad?.line2 || "", city: ad?.city || p.address?.city || "",
          state: ad?.state || p.address?.state || "", zip: (ad?.postalCode || p.postalCode || "").slice(0, 5),
          holder: b?.name || [p.firstName, p.lastName].filter(Boolean).join(" "),
          bname: b?.name || "", structure: b?.structure || "", bphone: (b?.phone || "").replace(/\D/g, "").slice(-10),
          bline1: ba?.line1 || "", bline2: ba?.line2 || "", bcity: ba?.city || "", bstate: ba?.state || "", bzip: (ba?.postalCode || "").slice(0, 5),
          email: id?.email || p.email || "", title: id?.title || "",
        }));
      })
      .catch((e) => setError(errText(e)));
  }, []);
  useEffect(() => { // the profile may hold the state's name, the select holds its code
    const hit = states.find((x) => x.name.toLowerCase() === v.state.toLowerCase());
    if (hit) setV((o) => ({ ...o, state: hit.isoCode }));
  }, [states, v.state]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value }));
  const hasBank = !!acct?.bank;
  const newBank = !hasBank || !!(v.routing || v.account || v.confirm); // with a bank on file, empty bank boxes keep it
  const dob = parseDob(v.dob);
  // Already with Stripe: optional, sent only when typed again (server rule).
  const dobOnFile = !!acct?.identity?.dobProvided, ssnOnFile = !!acct?.identity?.ssnLast4Provided;
  const biz = kind === "company", einOnFile = !!acct?.business?.einProvided;
  const ein = v.ein.replace(/\D/g, "");
  // Stripe can't change how an existing account is paid.
  const locked = !!acct && acct.status !== "not_started";
  const choose = (k: Kind) => { if (locked && k !== acct!.type) return setSwitchNote(true); setSwitchNote(false); setKind(k); };
  const tenDigits = (t: string) => /^\d{10}$/.test(t.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""));
  const check = (): Errors => ({
    ...(biz && {
      bname: !v.bname.trim() ? "Enter the business's legal name." : undefined,
      ein: einOnFile && !ein ? undefined : ein.length !== 9 ? "Enter the 9-digit EIN." : undefined,
      structure: !v.structure ? "Choose the business structure." : undefined,
      bline1: v.bline1.trim().length < 3 ? "Enter the business's street address." : undefined,
      bcity: v.bcity.trim().length < 2 ? "Enter the city." : undefined,
      bstate: !v.bstate ? "Choose the state." : undefined,
      bzip: !/^\d{5}$/.test(v.bzip) ? "Enter a 5-digit ZIP code." : undefined,
      bphone: !tenDigits(v.bphone) ? "Enter a 10-digit US phone number." : undefined,
    }),
    first: !v.first.trim() ? "Enter your legal first name." : undefined,
    last: !v.last.trim() ? "Enter your legal last name." : undefined,
    dob: dobOnFile && !v.dob ? undefined : !dob ? "Enter your date of birth as MM/DD/YYYY." : age(dob) < 18 ? "You must be 18 or older to be paid." : age(dob) > 120 ? "Check the year." : undefined,
    ssn: (ssnOnFile || biz) && !v.ssn ? undefined : !/^\d{4}$/.test(v.ssn) ? "Enter the last 4 digits of your SSN or ITIN." : undefined,
    phone: !tenDigits(v.phone) ? "Enter a 10-digit US phone number." : undefined,
    ...(biz && {
      email: !/^\S+@\S+\.\S+$/.test(v.email.trim()) ? "Enter your email address." : undefined,
      title: !v.title.trim() ? "Enter your title, for example Owner." : undefined,
    }),
    line1: v.line1.trim().length < 3 ? "Enter your street address." : undefined,
    city: v.city.trim().length < 2 ? "Enter your city." : undefined,
    state: !v.state ? "Choose your state." : undefined,
    zip: !/^\d{5}$/.test(v.zip) ? "Enter a 5-digit ZIP code." : undefined,
    holder: newBank && v.holder.trim().length < 2 ? "Enter the account holder's name." : undefined,
    routing: newBank && !validAba(v.routing) ? "Enter a valid 9-digit routing number." : undefined,
    account: newBank && !/^\d{4,17}$/.test(v.account) ? "Enter an account number of 4 to 17 digits." : undefined,
    confirm: newBank && /^\d{4,17}$/.test(v.account) && v.confirm !== v.account ? "The account numbers don't match." : undefined,
    password: hasBank && newBank && !v.password ? "Enter your password to change payout details." : undefined,
  });
  const errs: Errors = tried ? check() : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError("");
    if (hasErrors(check())) return;
    setBusy(true);
    const person = {
      firstName: v.first.trim(), lastName: v.last.trim(), ...(dob && { dob }), ...(v.ssn && { ssnLast4: v.ssn }),
      phone: "+1" + v.phone.replace(/\D/g, "").slice(-10),
      address: { line1: v.line1.trim(), ...(v.line2.trim() && { line2: v.line2.trim() }), city: v.city.trim(), state: v.state, postalCode: v.zip },
    };
    try {
      const bankToken = newBank
        ? await token((await loadStripe(pk)).createToken("bank_account", {
            country: "US", currency: "usd", routing_number: v.routing, account_number: v.account,
            account_holder_name: v.holder.trim(), account_holder_type: biz ? "company" : "individual",
          }))
        : undefined;
      const { data } = await api<PayoutAccount>("vendor/payouts/account", {
        method: "POST",
        body: {
          ...(biz ? {
            type: "company",
            company: {
              name: v.bname.trim(), ...(ein && { ein }), structure: v.structure, phone: "+1" + v.bphone.replace(/\D/g, "").slice(-10),
              address: { line1: v.bline1.trim(), ...(v.bline2.trim() && { line2: v.bline2.trim() }), city: v.bcity.trim(), state: v.bstate, postalCode: v.bzip },
            },
            representative: { ...person, email: v.email.trim(), title: v.title.trim() },
          } : person),
          ...(bankToken && { bankToken }), ...(hasBank && bankToken && { password: v.password }), tosAccepted: true,
        },
      });
      setAcct(data);
      setV((o) => ({ ...o, ssn: "", ein: "", routing: "", account: "", confirm: "", password: "" }));
      setTried(false);
      // Onboarding moves on once Stripe has what it needs (server step 4 → 5); needs info / disabled stay here.
      if (mode === "onboarding" && (data.status === "verified" || data.status === "pending")) return onDone();
      // Account › Bank: the status box above the form tells how it went, so it scrolls into view.
      if (data.status === "verified") toast("Payout details saved");
      else if (waiting(data.status)) setPoll((n) => n + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(errText(e));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  // The ask card sends one thing to Stripe; onboarding moves on once Stripe is checking it (same rule as submit).
  const asked = (a: PayoutAccount) => {
    setAcct(a);
    if (mode === "onboarding" && (a.status === "verified" || a.status === "pending")) onDone();
    else if (waiting(a.status)) setPoll((n) => n + 1);
  };

  const digits = { inputMode: "numeric" as const, autoComplete: "off", spellCheck: false };
  const st = acct?.status;
  const paidTo = acct?.bank && <span className="hint">Paid to {acct.bank.bankName ? `${acct.bank.bankName}, ` : ""}account ending {acct.bank.last4}</span>;
  let status = null;
  if (st === "verified") {
    status = (
      <div className={`box ${s.saved} ${s.status} ${s.done}`}>
        <b><CheckCircle size={20} weight="fill" aria-hidden />Verified. You're ready to get paid after each job.</b>
        {paidTo}
      </div>
    );
  } else if (st === "needs_info" || st === "disabled") {
    const [word, tag, line] = STATUS[st];
    status = (
      <div className={`box ${s.saved} ${s.status}`}>
        <span className={`tag ${tag}`}>{word}</span>
        <span>{line}</span>
        {st === "needs_info" && <Needs reqs={acct!.requirements} />}
        {paidTo}
      </div>
    );
  } else if (st === "pending" || (poll > 0 && waiting(st))) {
    status = slow ? (
      <div className={`box ${s.saved} ${s.status}`}>
        <b>Stripe is still checking.</b>
        <span>We&apos;ll update this page when it&apos;s done, usually within a few minutes.</span>
        {paidTo}
        <button type="button" className="btn" onClick={() => setPoll((n) => n + 1)}>Check again</button>
      </div>
    ) : (
      <div className={`box ${s.saved} ${s.status}`}>
        <b><span className="spin" aria-hidden />Stripe is checking your details</b>
        <span>This usually takes under a minute. You can leave this page; we&apos;ll keep your place.</span>
        {paidTo}
      </div>
    );
  }
  return (
    <div className={s.form}>
    {/* Always mounted so screen readers hear each change of status. */}
    <div className={s.live} role="status" aria-live="polite">{status}</div>
    {error && <p className="err" role="alert">{error}</p>}
    {acct && <StripeAsks acct={acct} onSaved={asked} />}
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!acct || busy}>
      <RequiredNote />
      <fieldset className={s.radios}>
        <legend className={s.label}>How you're paid</legend>
        {KINDS.map(([k, label]) => (
          <label key={k} className={s.check}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => choose(k)} /> {label}
          </label>
        ))}
      </fieldset>
      {switchNote && <p className="hint" role="status"><Link href={`/account/help?subject=${encodeURIComponent("Switch how I'm paid")}`}>Contact support</Link> to switch how you're paid.</p>}
      {biz && (
        <>
          <h2 className={s.label}>Your business</h2>
          <p className="hint">The business Stripe pays, as registered with the IRS. The EIN goes straight to Stripe; we never store it.</p>
          <div className={s.row3}>
            <Field id="bname" label="Business legal name" required error={errs.bname}><input autoComplete="organization" value={v.bname} onChange={set("bname")} maxLength={100} /></Field>
            <Field id="ein" label="EIN" required={!einOnFile} error={errs.ein} hint={einOnFile ? "On file. Leave empty to keep it." : "9 digits, XX-XXXXXXX."}>
              <input {...digits} value={einFocus || ein.length < 9 ? einText(ein) : `••-•••${ein.slice(5)}`} onChange={(e) => setV((o) => ({ ...o, ein: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                onFocus={() => setEinFocus(true)} onBlur={() => setEinFocus(false)} maxLength={10} placeholder="XX-XXXXXXX" />
            </Field>
            <SelectField id="structure" label="Business structure" required error={errs.structure} value={v.structure} onChange={(structure) => setV((o) => ({ ...o, structure }))} options={STRUCTURES} />
          </div>
          <div className={s.addrRow}>
            <Field id="bline1" label="Business street address" required error={errs.bline1}><input autoComplete="off" value={v.bline1} onChange={set("bline1")} maxLength={100} /></Field>
            <Field id="bcity" label="City" required error={errs.bcity}><input autoComplete="off" value={v.bcity} onChange={set("bcity")} maxLength={50} /></Field>
            <SelectField id="bstate" label="State" required error={errs.bstate} value={v.bstate} onChange={(bstate) => setV((o) => ({ ...o, bstate }))}
              options={states.map((x) => ({ value: x.isoCode, label: x.name }))} />
            <Field id="bzip" label="ZIP code" required error={errs.bzip}><input autoComplete="off" inputMode="numeric" value={v.bzip} onChange={set("bzip")} maxLength={5} /></Field>
          </div>
          <div className={s.row3}>
            <Field id="bline2" label="Suite (optional)"><input autoComplete="off" value={v.bline2} onChange={set("bline2")} maxLength={100} /></Field>
            <Field id="bphone" label="Business phone" required error={errs.bphone}><input type="tel" autoComplete="off" value={v.bphone} onChange={set("bphone")} maxLength={14} /></Field>
          </div>
        </>
      )}
      <h2 className={s.label}>{biz ? "You, running the business" : "About you"}</h2>
      <p className="hint">{biz
        ? "Required by US law from the person running the business: your name, date of birth, home address and, if you have one, the last 4 digits of your SSN or ITIN (without it, Stripe asks for a photo ID). It goes straight to Stripe; we never store it."
        : "Required by US law to pay you: your name, date of birth, address and the last 4 digits of your SSN or ITIN. It goes straight to Stripe; we never store it."}</p>
      <div className={s.row3}>
        <Field id="first" label="Legal first name" required error={errs.first}><input autoComplete="given-name" value={v.first} onChange={set("first")} maxLength={50} /></Field>
        <Field id="last" label="Legal last name" required error={errs.last}><input autoComplete="family-name" value={v.last} onChange={set("last")} maxLength={50} /></Field>
        <Field id="dob" label="Date of birth" required={!dobOnFile} error={errs.dob} hint={dobOnFile ? "On file. Leave empty to keep it." : undefined}>
          <input autoComplete="bday" inputMode="numeric" value={v.dob} onChange={set("dob")} maxLength={10} placeholder="MM/DD/YYYY" />
        </Field>
      </div>
      <div className={s.row3}>
        <Field id="ssn" label={biz ? "SSN or ITIN, last 4 digits (optional)" : "SSN or ITIN, last 4 digits"} required={!ssnOnFile && !biz} error={errs.ssn} hint={ssnOnFile ? "On file. Leave empty to keep it." : "Your US tax ID: Social Security or Individual Taxpayer ID number."}><input {...digits} type="password" value={v.ssn} onChange={set("ssn")} maxLength={4} /></Field>
        <Field id="phone" label="Mobile phone" required error={errs.phone}><input type="tel" autoComplete="tel-national" value={v.phone} onChange={set("phone")} maxLength={14} /></Field>
      </div>
      {biz && (
        <div className={s.row3}>
          <Field id="email" label="Email" required error={errs.email}><input type="email" autoComplete="email" value={v.email} onChange={set("email")} maxLength={100} /></Field>
          <Field id="title" label="Your title" required error={errs.title} hint="For example Owner, Managing member or CEO."><input autoComplete="organization-title" value={v.title} onChange={set("title")} maxLength={60} /></Field>
        </div>
      )}
      <div className={s.addrRow}>
        <Field id="line1" label="Home street address" required error={errs.line1}><input autoComplete="address-line1" value={v.line1} onChange={set("line1")} maxLength={100} /></Field>
        <Field id="city" label="City" required error={errs.city}><input autoComplete="address-level2" value={v.city} onChange={set("city")} maxLength={50} /></Field>
        <SelectField id="state" label="State" required error={errs.state} value={v.state} onChange={(state) => setV((o) => ({ ...o, state }))}
          options={states.map((x) => ({ value: x.isoCode, label: x.name }))} />
        <Field id="zip" label="ZIP code" required error={errs.zip}><input autoComplete="postal-code" inputMode="numeric" value={v.zip} onChange={set("zip")} maxLength={5} /></Field>
      </div>
      <div className={s.row3}>
        <Field id="line2" label="Apartment or suite (optional)"><input autoComplete="address-line2" value={v.line2} onChange={set("line2")} maxLength={100} /></Field>
      </div>

      <h2 className={s.label}>{biz ? "Business bank account" : "Bank account"}</h2>
      {biz && <p className="hint">The business's checking account, in its name.</p>}
      {hasBank && <p className="hint">Leave these empty to keep account ending {acct!.bank!.last4}. To change it, enter the new account.</p>}
      <div className={s.row3}>
        <Field id="holder" label="Account holder name" required={newBank} error={errs.holder} hint={biz ? "The business's name, as the bank has it." : undefined}><input autoComplete="name" value={v.holder} onChange={set("holder")} maxLength={100} /></Field>
        <Field id="routing" label="Routing number" required={newBank} error={errs.routing} hint="9 digits, on your checks or on your bank's website.">
          <input {...digits} value={v.routing} onChange={set("routing")} maxLength={9} />
        </Field>
      </div>
      <div className={s.row3}>
        <Field id="account" label="Account number" required={newBank} error={errs.account}><input {...digits} value={v.account} onChange={set("account")} maxLength={17} /></Field>
        <Field id="confirm" label="Confirm account number" required={newBank} error={errs.confirm}
          hint={!v.confirm ? "Type it again to check." : v.confirm === v.account ? <span className={s.match}><CheckCircle size={16} weight="fill" aria-hidden />The numbers match.</span> : "Not the same yet."}>
          <input {...digits} type="password" value={v.confirm} onChange={set("confirm")} onPaste={(e) => e.preventDefault()} maxLength={17} />
        </Field>
      </div>
      {hasBank && newBank && (
        <div className={s.row3}>
          <Field id="password" label="Your Any-Buddy password" required error={errs.password} hint="Needed to change where your earnings go.">
            <input type="password" autoComplete="current-password" value={v.password} onChange={set("password")} maxLength={128} />
          </Field>
        </div>
      )}
      <p className="hint">
        Payouts are processed by Stripe. By saving, you agree to the{" "}
        <a href="https://stripe.com/legal/connect-account" target="_blank" rel="noopener noreferrer">Stripe Connected Account Agreement</a>.
      </p>
      <Actions mode={mode} busy={busy} onBack={onBack} label={busy ? <><span className="spin" aria-hidden /> Sending to Stripe…</> : undefined} />
      </fieldset>
    </form>
    </div>
  );
}

/** What Stripe still needs: the ask card below, the words the form answers, then what goes through support (same as iOS). */
function Needs({ reqs }: { reqs: PayoutAccount["requirements"] }) {
  const { inForm, support } = needs(reqs);
  return (
    <>
      {reqs.some((r) => r.fix) && <span className="hint">Send what Stripe asks for below.</span>}
      {inForm.length > 0 && <ul>{inForm.map((t) => <li key={t}>{t}</li>)}</ul>}
      {inForm.length > 0 && <span className="hint">Add the missing details below, then save.</span>}
      {support.length > 0 && (
        <>
          <span>{SUPPORT_LEAD}</span>
          <ul>{support.map((t) => <li key={t}>{t}</li>)}</ul>
          <Link href={`/account/help?subject=${encodeURIComponent("Stripe needs: " + support.join(", "))}`}>Contact support</Link>
        </>
      )}
    </>
  );
}
