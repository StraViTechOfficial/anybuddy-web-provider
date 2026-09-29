"use client";
// What the auth screens share: field state and errors, the password box, server wording, the code timer.
import { useRef, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { ApiError } from "@/lib/api";
import s from "./auth.module.css";

type Values<K extends string> = Record<K, string>;

/**
 * An error shows after a submit attempt, or once the field was typed in and left (never on blur of an untouched
 * field); after that it follows every keystroke. `submit()` shows all errors and focuses the first wrong field.
 * Field order = key order of `initial`; each input's id is its key.
 */
export function useForm<K extends string>(initial: Values<K>, check: (v: Values<K>) => Partial<Record<K, string>>) {
  const [values, setValues] = useState(initial);
  const [shown, setShown] = useState<Set<K> | "all">(new Set());
  const typed = useRef(new Set<K>());
  const errors = check(values);
  const show = (k: K) => (shown === "all" || shown.has(k)) && !!errors[k];
  const reveal = (k: K) => setShown((x) => (x === "all" ? x : new Set(x).add(k)));

  const set = (k: K, v: string) => {
    typed.current.add(k);
    setValues((x) => ({ ...x, [k]: v }));
  };
  const field = (k: K) => ({
    id: k,
    name: k,
    value: values[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    // Leaving for the submit button: submit shows every error; showing it now would shift the button under the click.
    onBlur: (e: FocusEvent<HTMLInputElement>) => typed.current.has(k) && (e.relatedTarget as HTMLButtonElement | null)?.type !== "submit" && reveal(k),
    "aria-invalid": show(k) || undefined,
    "aria-describedby": show(k) ? `${k}-err` : undefined,
  });
  const error = (k: K) => (show(k) ? <p id={`${k}-err`} className="err">{errors[k]}</p> : null);
  const submit = () => {
    setShown("all");
    const first = (Object.keys(initial) as K[]).find((k) => errors[k]);
    if (first) document.getElementById(first)?.focus();
    return !first;
  };
  return { values, set, reveal, field, error, submit };
}

export function Password(props: InputHTMLAttributes<HTMLInputElement>) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.pw}>
      <input {...props} className="input" type={open ? "text" : "password"} maxLength={128} />
      <button type="button" className={s.eye} onClick={() => setOpen(!open)} aria-label={open ? "Hide password" : "Show password"} aria-pressed={open}>
        {open ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
      </button>
    </div>
  );
}

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
export const emailError = (v: string) =>
  !v.trim() ? "Enter your email address." : EMAIL.test(v.trim()) ? undefined : "Enter a valid email address, like name@example.com.";
export const newPasswordError = (v: string) =>
  v.length < 8 ? "Use at least 8 characters." : v.length > 128 ? "Use 128 characters or fewer." : undefined;

// Backend wording that reads badly (or says too much) on screen, in our words. Everything else is shown as sent.
const WORDS: [RegExp, string][] = [
  [/already exist/i, "An account already uses this email. Log in instead."],
  [/^otp expired$/i, "This code has expired. Send a new code."],
  [/^user not found\.?$/i, "That code isn't right. Check it and try again."], // unknown email in forgot: same as a wrong code
  [/^otp(invalid|required)$/i, "Enter all 6 digits."],
  [/password and confirm password/i, "The passwords don't match."],
];
export const say = (e: unknown) => {
  const m = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
  return WORDS.find(([re]) => re.test(m))?.[1] ?? m;
};

// When the live code stops working, kept per tab so a reload keeps the countdown. A time, not a secret.
const UNTIL = "ab_pro_code_until";
export const startCode = (seconds?: number) => {
  try { sessionStorage.setItem(UNTIL, String(Date.now() + (seconds || 600) * 1000)); } catch {}
};
export const codeUntil = () => {
  try { return Number(sessionStorage.getItem(UNTIL)) || 0; } catch { return 0; }
};

// Only same-site paths after log in (no open redirect).
export const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : "/");

// Where a signed-in Buddy goes: unfinished onboarding first (login and verify-otp both return `step`; 5 = done).
export const landing = (step: number | undefined, done: string) => (step && step < 5 ? "/onboarding" : done);
