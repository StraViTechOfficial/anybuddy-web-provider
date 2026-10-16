"use client";
// What the auth screens share: field state and errors, the server's wording, and where a signed-in Buddy goes next.
import { ApiError } from "@/lib/api";

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
export const emailError = (v: string) =>
  !v.trim() ? "Enter your email address." : EMAIL.test(v.trim()) ? undefined : "Enter a valid email address, like name@example.com.";

// Backend messages that read badly or say too much on screen, rewritten in our words. Everything else is shown as sent.
const WORDS: [RegExp, string][] = [
  [/already exist/i, "An account already uses this email. Log in instead."],
  [/^otp expired$/i, "This code has expired. Send a new code."],
  [/^user not found\.?$/i, "That code isn't right. Check it and try again."], // an unknown email in forgot gets the same message as a wrong code
  [/^otp(invalid|required)$/i, "Enter all 6 digits."],
];
export const say = (e: unknown) => {
  const m = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
  return WORDS.find(([re]) => re.test(m))?.[1] ?? m;
};

// After log in, only go to paths on this site, so the page can't be used as an open redirect.
export const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : "/");

// After any successful log in on this device, the 18+ and Terms box shows as ticked next time. This uses
// localStorage, which the browser may block.
const AGREED = "ab_pro_terms";
export const agreedBefore = () => { try { return localStorage.getItem(AGREED) === "1"; } catch { return false; } };
export const rememberAgreed = () => { try { localStorage.setItem(AGREED, "1"); } catch { /* in private mode, ask again next time */ } };
