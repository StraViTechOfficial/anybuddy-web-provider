// Run: node --experimental-strip-types --no-warnings "src/app/(app)/earnings/period.check.mjs"
import assert from "node:assert/strict";
import { periodBars, fill } from "./period.ts";

// 2026-09-29 is a Tuesday, so the week starts Monday 28 Sep.
const w = periodBars("week", "2026-09-29");
assert.deepEqual([w.from, w.to, w.bars.map((b) => b.label)], ["2026-09-28", "2026-10-04", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]);
assert.deepEqual(w.bars.map((b) => (b.now ? "n" : b.later ? "l" : "p")).join(""), "pnlllll");

const m = periodBars("month", "2026-09-29");
assert.deepEqual(m.bars.map((b) => [b.from, b.to]), [
  ["2026-09-01", "2026-09-06"], ["2026-09-07", "2026-09-13"], ["2026-09-14", "2026-09-20"], ["2026-09-21", "2026-09-27"], ["2026-09-28", "2026-09-30"],
]);
assert.deepEqual(m.bars.map((b) => b.now), [false, false, false, false, true]);

const l = periodBars("last", "2026-03-15");
assert.deepEqual([l.from, l.to, l.bars.length], ["2026-02-01", "2026-02-28", 5]); // 1 Feb 2026 is a Sunday: its own short week
assert.equal(periodBars("last", "2026-01-10").from, "2025-12-01");

const a = periodBars("all", "2026-09-29", "2026-07-20");
assert.deepEqual(a.bars.map((b) => b.label), ["Jul", "Aug", "Sep"]);

const f = fill(m.bars, [{ key: "2026-09-02", amount: 0.1 }, { key: "2026-09-06", amount: 0.2 }, { key: "2026-09-29", amount: 76.5 }, { key: "2026-08-31", amount: 9 }]);
assert.deepEqual(f.map((b) => b.total), [0.3, 0, 0, 0, 76.5]);
console.log("period ok");
import { ticks } from "./period.ts";
assert.deepEqual(ticks(255), [0, 100, 200, 300]);
assert.deepEqual(ticks(500), [0, 250, 500]);
assert.deepEqual(ticks(765), [0, 500, 1000]);
assert.deepEqual(ticks(12.5), [0, 5, 10, 15]);
assert.deepEqual(ticks(0.5), [0, 0.25, 0.5]);
for (const n of [1, 3, 7, 99, 101, 1234, 99999]) { const t = ticks(n); assert.ok(t.length >= 3 && t.length <= 4 && t.at(-1) >= n, `${n}: ${t}`); }
console.log("ticks ok");
