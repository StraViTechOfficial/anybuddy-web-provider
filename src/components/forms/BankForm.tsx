"use client";
import { CheckCircle } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { payoutsConfig, type PayoutsConfig } from "@/lib/stripe";
import { StripeBankForm } from "./StripeBankForm";
import type { VendorBank } from "@/lib/types";
import { Actions, Field, Req, RequiredNote, errText, hasErrors, type Errors, type FormProps } from "./Field";
import { ChangeCode, CODE_MISSING } from "./ChangeCode";
import { EMPTY_CODE } from "@/components/Code";
import s from "./forms.module.css";

/** US routing (ABA) number: 9 digits whose 3-7-1 weighted sum is a multiple of 10 (same rule as the server). */
export const validAba = (n: string) => /^\d{9}$/.test(n) && [...n].reduce((t, d, i) => t + +d * [3, 7, 1][i % 3], 0) % 10 === 0;

const EMPTY = { holder: "", bank: "", routing: "", account: "", confirm: "", type: "Checking" };

// Screen 5 and Account › Bank. Stripe mode (server flag, contract 30 Sep) gets its own form; manual mode, or no answer
// from the server, keeps this one.
export function BankForm(p: FormProps) {
  const [cfg, setCfg] = useState<PayoutsConfig | null>(null);
  useEffect(() => { payoutsConfig().then(setCfg); }, []);
  if (!cfg) return <div className="skeleton" style={{ height: 320 }} aria-label="Loading bank details" />;
  return cfg.mode === "stripe" && cfg.publishableKey ? <StripeBankForm {...p} pk={cfg.publishableKey} /> : <ManualBankForm {...p} />;
}

// Manual mode. The saved account shows only as its last 4; changing it needs a code sent to the Buddy (v2 §8).
function ManualBankForm({ mode, onDone, onBack }: FormProps) {
  const [v, setV] = useState(EMPTY);
  const [last4, setLast4] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false); // inputs stay disabled until the saved values are in
  const [code, setCode] = useState(EMPTY_CODE);

  useEffect(() => {
    api<VendorBank>("vendor/auth/get-profile-details", { query: { type: 4 } })
      .then(({ data: b }) => {
        setV((o) => ({
          ...o, holder: b?.account_holder_name ?? "", bank: b?.bank_name ?? "", routing: b?.routing_number ?? "",
          type: /^sav/i.test(b?.account_type ?? "") ? "Savings" : "Checking",
        }));
        setLast4((b?.account_number ?? "").replace(/\D/g, "").slice(-4)); // the full number is never kept here
      })
      .then(() => setLoaded(true))
      .catch((e) => setError(errText(e)));
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value }));
  const check = (): Errors => ({
    holder: v.holder.trim().length < 2 ? "Enter the account holder's name." : undefined,
    bank: v.bank.trim().length < 2 ? "Enter your bank's name." : undefined,
    routing: !validAba(v.routing) ? "Enter a valid 9-digit routing number." : undefined,
    account: !/^\d{4,17}$/.test(v.account) ? "Enter an account number of 4 to 17 digits." : undefined,
    confirm: /^\d{4,17}$/.test(v.account) && v.confirm !== v.account ? "The account numbers don't match." : undefined,
    changeCode: last4 && !/^\d{6}$/.test(code.join("")) ? CODE_MISSING : undefined,
  });
  const errs: Errors = tried ? check() : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError("");
    if (hasErrors(check())) return;
    setBusy(true);
    try {
      await api("vendor/auth/update-register-profile", {
        method: "POST",
        body: {
          step: 4, account_holder_name: v.holder.trim(), bank_name: v.bank.trim(), routing_number: v.routing,
          account_number: v.account, account_type: v.type, ...(last4 && { changeCode: code.join("") }),
        },
      });
      setLast4(v.account.slice(-4));
      setV((o) => ({ ...o, account: "", confirm: "" }));
      setCode(EMPTY_CODE);
      setTried(false);
      onDone();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const digits = { inputMode: "numeric" as const, autoComplete: "off", spellCheck: false };
  return (
    <form method="post" onSubmit={submit} noValidate>
      <fieldset className={s.form} disabled={!loaded}>
      <RequiredNote />
      {last4 && <p className={`box ${s.saved}`}><b>Account ending {last4}</b><span className="hint">To change your payout details, enter the account number again.</span></p>}
      <div className={s.row3}>
        <Field id="holder" label="Account holder name" required error={errs.holder}><input autoComplete="name" value={v.holder} onChange={set("holder")} maxLength={100} /></Field>
        <Field id="bank" label="Bank name" required error={errs.bank}><input autoComplete="off" value={v.bank} onChange={set("bank")} maxLength={100} /></Field>
        <Field id="routing" label="Routing number" required error={errs.routing} hint="9 digits, on your checks or on your bank's website.">
          <input {...digits} value={v.routing} onChange={set("routing")} maxLength={9} />
        </Field>
      </div>
      <div className={s.row3}>
        {/* Owner 29 Sep: the first box shows the number so the Buddy can read it; the second stays hidden and a live
            line says whether the two match; no pasting into it (owner, payouts plan), so it is really typed twice.
            The saved number still shows only as its last 4. */}
        <Field id="account" label="Account number" required error={errs.account}><input {...digits} value={v.account} onChange={set("account")} maxLength={17} /></Field>
        <Field id="confirm" label="Confirm account number" required error={errs.confirm}
          hint={!v.confirm ? "Type it again to check." : v.confirm === v.account ? <span className={s.match}><CheckCircle size={16} weight="fill" aria-hidden />The numbers match.</span> : "Not the same yet."}>
          <input {...digits} type="password" value={v.confirm} onChange={set("confirm")} onPaste={(e) => e.preventDefault()} maxLength={17} />
        </Field>
      <fieldset className={s.radios}>
        <legend className={s.label}>Account type<Req /></legend>
        {["Checking", "Savings"].map((t) => (
          <label key={t} className={s.check}>
            <input type="radio" name="type" value={t} checked={v.type === t} onChange={set("type")} /> {t}
          </label>
        ))}
      </fieldset>
      </div>
      {last4 && <ChangeCode value={code} onChange={setCode} error={errs.changeCode} />}
      <Actions mode={mode} busy={busy} onBack={onBack} error={error} />
      </fieldset>
    </form>
  );
}
