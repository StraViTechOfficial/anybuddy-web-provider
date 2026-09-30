// Stripe payouts (contract 30 Sep): bank and card numbers go from the browser straight to Stripe as tokens;
// our server only ever gets btok_/tok_ ids. Stripe.js is the official script, loaded once.
import { api } from "./api";
import type { PayoutAccount } from "./types";

export type PayoutsConfig = { mode: "stripe" | "manual"; publishableKey?: string };

/** Payouts mode from the server; any failure means "manual" (today's behaviour). */
export const payoutsConfig = () =>
  api<PayoutsConfig>("vendor/payouts/config").then((r) => r.data, () => ({ mode: "manual" as const }));

export const payoutAccount = () => api<PayoutAccount>("vendor/payouts/account").then((r) => r.data);

// The slice of Stripe.js we use.
type TokenResult = { token?: { id: string }; error?: { message?: string } };
export type CardElement = { mount: (el: HTMLElement) => void; destroy: () => void; on: (e: "change", fn: (ev: { error?: { message?: string } }) => void) => void };
export type Stripe = {
  createToken: ((type: "bank_account", data: Record<string, string>) => Promise<TokenResult>) & ((el: CardElement, data?: Record<string, string>) => Promise<TokenResult>);
  elements: () => { create: (type: "card", opts?: object) => CardElement };
};
declare global { interface Window { Stripe?: (key: string) => Stripe } }

let script: Promise<void> | null = null;
const instances = new Map<string, Stripe>();

export async function loadStripe(key: string): Promise<Stripe> {
  script ??= new Promise<void>((ok, fail) => {
    if (window.Stripe) return ok();
    const el = document.createElement("script");
    el.src = "https://js.stripe.com/v3";
    el.onload = () => ok();
    el.onerror = () => { script = null; fail(new Error("Couldn't reach Stripe. Check your connection and try again.")); };
    document.head.appendChild(el);
  });
  await script;
  if (!instances.has(key)) instances.set(key, window.Stripe!(key));
  return instances.get(key)!;
}

/** A Stripe token id, or throws with Stripe's own message (e.g. "Routing number must have 9 digits"). */
export async function token(p: Promise<TokenResult>) {
  const r = await p;
  if (!r.token) throw new Error(r.error?.message || "Stripe couldn't check these details. Try again.");
  return r.token.id;
}
