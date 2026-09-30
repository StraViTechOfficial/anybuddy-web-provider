"use client";
import { CheckCircle } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { age, needs, NEEDS_LEAD, parseDob, SUPPORT_LEAD } from "@/lib/pay";
import { loadStripe, payoutAccount, token } from "@/lib/stripe";
import type { PayoutAccount, VendorProfile } from "@/lib/types";
import { validAba } from "./BankForm";
import { Actions, Field, RequiredNote, SelectField, errText, hasErrors, type Errors, type FormProps } from "./Field";
import s from "./forms.module.css";

type State = { name: string; isoCode: string };
const EMPTY = {
  first: "", last: "", dob: "", ssn: "", phone: "", line1: "", line2: "", city: "", state: "", zip: "",
  holder: "", routing: "", account: "", confirm: "", password: "",
};
const STATUS: Record<PayoutAccount["status"], [string, string, string]> = {
  not_started: ["", "", ""],
  // Same words as the iOS app (Payouts.statusRows).
  pending: ["Pending", "t-wait", "Stripe is checking your details, usually a few minutes."],
  needs_info: ["Needs info", "t-bad", NEEDS_LEAD],
  verified: ["Verified", "t-ok", "Earnings go to your bank after each job."],
  disabled: ["Disabled", "t-bad", "Payouts are paused on this account. Contact support to turn them back on."],
};

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

  useEffect(() => {
    api<State[]>("list-location", { query: { country: "United States" } })
      .then((r) => setStates(r.data.filter((x) => /^[A-Z]{2}$/.test(x.isoCode))))
      .catch(() => {});
    // Prefill from what Stripe has (identity: never the DOB or SSN), else the profile; the Buddy checks it.
    Promise.all([payoutAccount(), api<VendorProfile>("vendor/auth/get-profile-details", { query: { type: 1 } })])
      .then(([a, { data: p }]) => {
        setAcct(a);
        const id = a.identity, ad = id?.address;
        setV((o) => ({
          ...o, first: id?.firstName || p.firstName || "", last: id?.lastName || p.lastName || "",
          phone: (id?.phone || p.phone || "").replace(/\D/g, "").slice(-10),
          line1: ad?.line1 || p.address?.street || "", line2: ad?.line2 || "", city: ad?.city || p.address?.city || "",
          state: ad?.state || p.address?.state || "", zip: (ad?.postalCode || p.postalCode || "").slice(0, 5),
          holder: [p.firstName, p.lastName].filter(Boolean).join(" "),
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
  const check = (): Errors => ({
    first: !v.first.trim() ? "Enter your legal first name." : undefined,
    last: !v.last.trim() ? "Enter your legal last name." : undefined,
    dob: dobOnFile && !v.dob ? undefined : !dob ? "Enter your date of birth as MM/DD/YYYY." : age(dob) < 18 ? "You must be 18 or older to be paid." : age(dob) > 120 ? "Check the year." : undefined,
    ssn: ssnOnFile && !v.ssn ? undefined : !/^\d{4}$/.test(v.ssn) ? "Enter the last 4 digits of your SSN or ITIN." : undefined,
    phone: !/^\d{10}$/.test(v.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")) ? "Enter a 10-digit US phone number." : undefined,
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
    try {
      const bankToken = newBank
        ? await token((await loadStripe(pk)).createToken("bank_account", {
            country: "US", currency: "usd", routing_number: v.routing, account_number: v.account,
            account_holder_name: v.holder.trim(), account_holder_type: "individual",
          }))
        : undefined;
      const { data } = await api<PayoutAccount>("vendor/payouts/account", {
        method: "POST",
        body: {
          firstName: v.first.trim(), lastName: v.last.trim(), ...(dob && { dob }), ...(v.ssn && { ssnLast4: v.ssn }),
          phone: "+1" + v.phone.replace(/\D/g, "").slice(-10),
          address: { line1: v.line1.trim(), ...(v.line2.trim() && { line2: v.line2.trim() }), city: v.city.trim(), state: v.state, postalCode: v.zip },
          ...(bankToken && { bankToken }), ...(hasBank && bankToken && { password: v.password }), tosAccepted: true,
        },
      });
      setAcct(data);
      setV((o) => ({ ...o, ssn: "", routing: "", account: "", confirm: "", password: "" }));
      setTried(false);
      // Onboarding moves on once Stripe has what it needs (server step 4 → 5); needs info / disabled stay here.
      if (mode !== "onboarding" || data.status === "verified" || data.status === "pending") onDone();
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const digits = { inputMode: "numeric" as const, autoComplete: "off", spellCheck: false };
  const [word, tag, line] = STATUS[acct?.status ?? "not_started"];
  return (
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!acct}>
      {word && (
        <div className={`box ${s.saved} ${s.status}`} role="status">
          <span className={`tag ${tag}`}>{word}</span>
          <span>{line}</span>
          {acct?.status === "needs_info" && <Needs reqs={acct.requirements} />}
          {acct?.bank && <span className="hint">Paid to {acct.bank.bankName ? `${acct.bank.bankName}, ` : ""}account ending {acct.bank.last4}</span>}
        </div>
      )}
      <RequiredNote />
      <h2 className={s.label}>About you</h2>
      <p className="hint">Required by US law to pay you: your name, date of birth, address and the last 4 digits of your SSN or ITIN. It goes straight to Stripe; we never store it.</p>
      <div className={s.row3}>
        <Field id="first" label="Legal first name" required error={errs.first}><input autoComplete="given-name" value={v.first} onChange={set("first")} maxLength={50} /></Field>
        <Field id="last" label="Legal last name" required error={errs.last}><input autoComplete="family-name" value={v.last} onChange={set("last")} maxLength={50} /></Field>
        <Field id="dob" label="Date of birth" required={!dobOnFile} error={errs.dob} hint={dobOnFile ? "On file. Leave empty to keep it." : undefined}>
          <input autoComplete="bday" inputMode="numeric" value={v.dob} onChange={set("dob")} maxLength={10} placeholder="MM/DD/YYYY" />
        </Field>
      </div>
      <div className={s.row3}>
        <Field id="ssn" label="SSN or ITIN, last 4 digits" required={!ssnOnFile} error={errs.ssn} hint={ssnOnFile ? "On file. Leave empty to keep it." : "Your US tax ID: Social Security or Individual Taxpayer ID number."}><input {...digits} type="password" value={v.ssn} onChange={set("ssn")} maxLength={4} /></Field>
        <Field id="phone" label="Mobile phone" required error={errs.phone}><input type="tel" autoComplete="tel-national" value={v.phone} onChange={set("phone")} maxLength={14} /></Field>
      </div>
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

      <h2 className={s.label}>Bank account</h2>
      {hasBank && <p className="hint">Leave these empty to keep account ending {acct!.bank!.last4}. To change it, enter the new account.</p>}
      <div className={s.row3}>
        <Field id="holder" label="Account holder name" required={newBank} error={errs.holder}><input autoComplete="name" value={v.holder} onChange={set("holder")} maxLength={100} /></Field>
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
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} />
      </fieldset>
    </form>
  );
}

/** What Stripe still needs: the words the form below answers, then what goes through support (same as iOS). */
function Needs({ reqs }: { reqs: PayoutAccount["requirements"] }) {
  const { inForm, support } = needs(reqs);
  return (
    <>
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
