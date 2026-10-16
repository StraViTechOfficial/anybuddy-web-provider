"use client";
// What the auth screens share: field state and errors, server wording, where a signed-in Buddy goes.
import { ApiError } from "@/lib/api";

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
