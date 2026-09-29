"use client";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import s from "./forms.module.css";

// Shared by the five setup forms: one label/error/hint rule, one submit bar, one "first wrong field" rule.
export type Mode = "onboarding" | "edit";
export type FormProps = { mode: Mode; onDone: () => void; onBack?: () => void };
export type Errors = Record<string, string | undefined>;

type Control = ReactElement<{ id?: string; className?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;

/** Label above, hint and error below. The control gets its id, aria-invalid and aria-describedby here. */
export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: Control }) {
  const described = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label className={s.label} htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        className: children.props.className ?? "input",
        "aria-invalid": error ? true : undefined,
        "aria-describedby": described,
      })}
      {hint && <small id={`${id}-hint`} className="hint">{hint}</small>}
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
