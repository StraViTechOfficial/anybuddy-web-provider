// The Buddy's money on a job, worked out from server numbers only, with the same rule as the iOS app (JobText.share).
// These functions are pure, and pay.check.mjs tests them (node --experimental-strip-types).
type Money = { price?: number; vendorPriceAfterDetection?: number; commissionAmount?: number; taxAmount?: number; billedAmount?: number };

/** The Buddy's share after AnyBuddy's fee, or null when unknown (old rows use 0 for unknown). It never falls back to
 *  the price. */
export const shareOf = (j: Money) => (j.vendorPriceAfterDetection ?? 0) > 0 ? j.vendorPriceAfterDetection! : null;

// Stripe requirements that the bank form's own fields answer, matched by code prefix. Ones with a `fix` (full SSN,
// photo ID, proof of address) have their own card (StripeAsks), and anything else goes through support. The list and
// wording match iOS.
const IN_FORM = ["individual.first_name", "individual.last_name", "individual.dob", "individual.ssn_last_4", "individual.phone",
  "individual.address", "external_account", "tos_acceptance",
  "company.name", "company.tax_id", "company.structure", "company.phone", "company.address"];
// For business accounts, the representative (the Buddy) appears as `representative.*` or `person_xxx.*`.
const REP_IN_FORM = /^(representative|person_[^.]+)\.(first_name|last_name|dob|ssn_last_4|phone|address|email|relationship\.title)/;
/** Turns Stripe's list (one entry per key, so "Date of birth" can appear 3 times) into unique items, split by who can
 * fix them. Requirements with a `fix` are in neither list, because the StripeAsks card answers them. */
export function needs(reqs: { code: string; text: string; fix?: string }[]) {
  const words = (inForm: boolean) => [...new Set(reqs.filter((r) => !r.fix && (IN_FORM.some((p) => r.code.startsWith(p)) || REP_IN_FORM.test(r.code)) === inForm).map((r) => r.text))];
  return { inForm: words(true), support: words(false) };
}
export const NEEDS_LEAD = "Stripe needs a few more details before it can pay you:";
export const ASKS_LEAD = "Stripe needs one more thing to pay you";
export const SUPPORT_LEAD = "Contact support to send these:";

// The instant payout fee, using the server's estimate of Stripe's rate (helper/stripePayouts.ts): 1.5%, and at least $0.50.
export const instantFee = (amount: number) => Math.max(0.5, Math.round(amount * 1.5) / 100);

export const PAYOUT_WORD = { pending: "Pending", sent: "Sent", paid: "Paid", failed: "Failed", reversed: "Reversed" } as const;

// Payout identity in Stripe mode. The date of birth is typed as MM/DD/YYYY, and Stripe needs the Buddy to be 18 or older.
/** Parses "MM/DD/YYYY" into {day, month, year} when it is a real date, or returns null. */
export function parseDob(t: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t.trim());
  if (!m) return null;
  const [month, day, year] = [+m[1], +m[2], +m[3]];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? { day, month, year } : null;
}
/** Whole years between a birth date and today. */
export const age = ({ day, month, year }: { day: number; month: number; year: number }, now = new Date()) =>
  now.getFullYear() - year - (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0);
