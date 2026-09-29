"use client";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { Select, type SelectProps } from "@/components/ui/Select";
import s from "./forms.module.css";

// Shared by the five setup forms: one label/error/hint rule, one submit bar, one "first wrong field" rule.
export type Mode = "onboarding" | "edit";
export type FormProps = { mode: Mode; onDone: () => void; onBack?: () => void };
export type Errors = Record<string, string | undefined>;

type Control = ReactElement<{ id?: string; className?: string; required?: boolean; "aria-invalid"?: boolean; "aria-describedby"?: string }>;

/** The required mark after a label. Screen readers get "required" from the control itself, so the star is hidden from them. */
export const Req = () => <span className={s.req} aria-hidden> *</span>;
/** One line at the top of every form that has a required field. */
export const RequiredNote = () => <p className={s.reqNote}><span aria-hidden>*</span> Required</p>;

/** Label above, hint and error below. The control gets its id, required, aria-invalid and aria-describedby here. */
export function Field({ id, label, error, hint, required, children }: { id: string; label: string; error?: string; hint?: ReactNode; required?: boolean; children: Control }) {
  const described = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label className={s.label} htmlFor={id}>{label}{required && <Req />}</label>
      {cloneElement(children, {
        id,
        className: children.props.className ?? "input",
        required: required || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": described,
      })}
      {hint && <small id={`${id}-hint`} className="hint">{hint}</small>}
      {error && <small id={`${id}-err`} className="err">{error}</small>}
    </div>
  );
}

/** Field's label/error rule around the shared Select (native selects are replaced, owner 29 Sep). */
export function SelectField({ id, label, error, required, ...rest }: Omit<SelectProps, "id" | "label" | "hideLabel" | "invalid" | "describedBy"> & { id: string; label: string; error?: string; required?: boolean }) {
  return (
    <div className="field">
      <label className={s.label} htmlFor={id}>{label}{required && <Req />}</label>
      <Select {...rest} id={id} label={label} hideLabel invalid={!!error} describedBy={error ? `${id}-err` : undefined} />
      {error && <small id={`${id}-err`} className="err">{error}</small>}
    </div>
  );
}

/** True when there are errors; the first wrong field (by insertion order) gets focus. */
export function hasErrors(e: Errors) {
  const first = Object.keys(e).find((k) => e[k]);
  if (first) document.getElementById(first)?.focus();
  return Boolean(first);
}

/** Back (onboarding), the busy submit button, and the server error next to them. */
export function Actions({ mode, busy, onBack, error, label }: { mode: Mode; busy: boolean; onBack?: () => void; error?: string; label?: string }) {
  return (
    <div className={s.actions}>
      {error && <p className="err" role="alert">{error}</p>}
      <div className={s.buttons}>
        {onBack && <button type="button" className="btn lg" onClick={onBack}>Back</button>}
        <button className="btn p lg" disabled={busy} aria-busy={busy}>
          {label ?? (mode === "edit" ? "Save" : "Continue")}
        </button>
      </div>
    </div>
  );
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

/** Profile and service rates: whole dollars, $1 to $1,000 (same as iOS). */
export const rateError = (r: string) => (!/^\d+$/.test(r) || +r < 1 || +r > 1000 ? "Enter a whole-dollar rate from $1 to $1,000." : undefined);
