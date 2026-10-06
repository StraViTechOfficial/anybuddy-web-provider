"use client";
// What the auth screens share: field state and errors, server wording, where a signed-in Buddy goes.
import { useRef, useState, type ChangeEvent, type FocusEvent } from "react";
import { ApiError } from "@/lib/api";

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

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
export const emailError = (v: string) =>
  !v.trim() ? "Enter your email address." : EMAIL.test(v.trim()) ? undefined : "Enter a valid email address, like name@example.com.";

// Backend wording that reads badly (or says too much) on screen, in our words. Everything else is shown as sent.
const WORDS: [RegExp, string][] = [
  [/already exist/i, "An account already uses this email. Log in instead."],
  [/^otp expired$/i, "This code has expired. Send a new code."],
  [/^user not found\.?$/i, "That code isn't right. Check it and try again."], // unknown email in forgot: same as a wrong code
  [/^otp(invalid|required)$/i, "Enter all 6 digits."],
];
export const say = (e: unknown) => {
  const m = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
  return WORDS.find(([re]) => re.test(m))?.[1] ?? m;
};

// Only same-site paths after log in (no open redirect).
export const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : "/");

// v3: after any successful login on this device the 18+/Terms box shows ticked next time (localStorage; may be blocked).
const AGREED = "ab_pro_terms";
export const agreedBefore = () => { try { return localStorage.getItem(AGREED) === "1"; } catch { return false; } };
export const rememberAgreed = () => { try { localStorage.setItem(AGREED, "1"); } catch { /* private mode: ask again next time */ } };
