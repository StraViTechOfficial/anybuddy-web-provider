// Run: node --experimental-strip-types --no-warnings src/lib/pay.check.mjs
import assert from "node:assert/strict";
import { shareOf } from "./pay.ts";

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
