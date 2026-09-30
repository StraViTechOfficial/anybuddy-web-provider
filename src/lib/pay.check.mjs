// Run: node --experimental-strip-types --no-warnings src/lib/pay.check.mjs
import assert from "node:assert/strict";
import { breakdown, shareOf } from "./pay.ts";

assert.deepEqual(breakdown({ price: 85, commissionAmount: 9, vendorPriceAfterDetection: 71, taxAmount: 5 }), { paid: 85, fee: 9, tax: 5 }); // D-67
assert.deepEqual(breakdown({ price: 85, commissionAmount: 9, vendorPriceAfterDetection: 72, taxAmount: 5 }), { paid: 85, fee: 9, tax: 5 }); // ±$1 rounding
assert.equal(breakdown({ price: 85, commissionAmount: 9, vendorPriceAfterDetection: 76, taxAmount: 5 }), null); // old rule (tax to Buddy) no longer adds up
assert.deepEqual(breakdown({ price: 85, commissionAmount: 9, vendorPriceAfterDetection: 76 }), { paid: 85, fee: 9, tax: 0 }); // no tax
assert.deepEqual(breakdown({ price: 85, billedAmount: 127, commissionAmount: 12, vendorPriceAfterDetection: 108, taxAmount: 7 }), { paid: 127, fee: 12, tax: 7 });
assert.equal(breakdown({ price: 85, commissionAmount: 9, vendorPriceAfterDetection: 70 }), null); // doesn't add up
assert.equal(breakdown({ price: 85, commissionAmount: 0, vendorPriceAfterDetection: 85 }), null); // fee unknown
assert.equal(breakdown({ price: 85, commissionAmount: 9 }), null);
assert.equal(shareOf({ vendorPriceAfterDetection: 0 }), null);
assert.equal(shareOf({ vendorPriceAfterDetection: 76 }), 76);
console.log("pay ok");
import { age, parseDob } from "./pay.ts";
assert.deepEqual(parseDob("02/29/2000"), { day: 29, month: 2, year: 2000 });
assert.equal(parseDob("02/29/2001"), null);
assert.equal(parseDob("13/01/2000"), null);
const now = new Date(2026, 8, 30); // 30 Sep 2026
assert.equal(age({ day: 30, month: 9, year: 2008 }, now), 18);
assert.equal(age({ day: 1, month: 10, year: 2008 }, now), 17);
console.log("dob ok");
import { instantFee, needs } from "./pay.ts";
assert.deepEqual(needs([
  { code: "individual.dob.day", text: "Date of birth" }, { code: "individual.dob.year", text: "Date of birth" },
  { code: "individual.verification.document", text: "Photo ID" }, { code: "individual.id_number", text: "Full Social Security number" },
  { code: "external_account", text: "Bank account" }, { code: "individual.email", text: "Email address" },
]), { inForm: ["Date of birth", "Bank account"], support: ["Photo ID", "Full Social Security number", "Email address"] });
assert.equal(instantFee(10), 0.5); // minimum
assert.equal(instantFee(100), 1.5);
console.log("needs ok");
