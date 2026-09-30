// The Buddy's money on a job, from server numbers only (same rule as the iOS app, JobText.breakdown). Pure.
// Checked by pay.check.mjs (node --experimental-strip-types).
type Money = { price?: number; vendorPriceAfterDetection?: number; commissionAmount?: number; taxAmount?: number; billedAmount?: number };

/** The Buddy's share after Any-Buddy's fee. null when unknown (0 is how old rows say unknown); never falls back to price. */
export const shareOf = (j: Money) => (j.vendorPriceAfterDetection ?? 0) > 0 ? j.vendorPriceAfterDetection! : null;

/** Customer paid / fee / sales tax, only when they add up. D-67: AnyBuddy pays the tax to the state, so
 *  paid − fee − tax = share (±$1: the server rounds the share to dollars). Tax is `taxAmount` (set at booking; not
 *  recomputed at check-out, so a billed job whose tax moved won't add up and falls back). null: show "You earn" alone. */
export function breakdown(j: Money) {
  const share = shareOf(j), billed = j.billedAmount ?? 0, paid = billed > 0 ? billed : j.price ?? 0, fee = j.commissionAmount ?? 0;
  const tax = Math.max(0, j.taxAmount ?? 0);
  if (share === null || paid <= 0 || fee <= 0 || Math.abs(paid - fee - tax - share) > 1) return null;
  return { paid, fee, tax };
}

// Stripe requirements (contract "Changes", 30 Sep): the codes the bank form's own fields answer, by prefix. Anything
// else (photo ID, full SSN, proof of address, "More information") goes through support. Same list and words as iOS.
const IN_FORM = ["individual.first_name", "individual.last_name", "individual.dob", "individual.ssn_last_4", "individual.phone",
  "individual.address", "external_account", "tos_acceptance"];
/** Stripe's list (one entry per key, so "Date of birth" can come 3 times) → unique words, split by who can fix them. */
export function needs(reqs: { code: string; text: string }[]) {
  const words = (inForm: boolean) => [...new Set(reqs.filter((r) => IN_FORM.some((p) => r.code.startsWith(p)) === inForm).map((r) => r.text))];
  return { inForm: words(true), support: words(false) };
}
export const NEEDS_LEAD = "Stripe needs a few more details before it can pay you:";
export const SUPPORT_LEAD = "Contact support to send these:";

// Instant payout fee, the server's estimate of Stripe's rate (helper/stripePayouts.ts): 1.5%, at least $0.50.
export const instantFee = (amount: number) => Math.max(0.5, Math.round(amount * 1.5) / 100);

export const PAYOUT_WORD = { pending: "Pending", sent: "Sent", paid: "Paid", failed: "Failed", reversed: "Reversed" } as const;

// Payout identity (Stripe mode): date of birth typed as MM/DD/YYYY; Stripe needs the Buddy to be 18 or older.
/** "MM/DD/YYYY" → {day, month, year} when it is a real date, else null. */
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
