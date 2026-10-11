import assert from "node:assert/strict";
import { neighbourRanks, ranksReachableFrom } from "../web/lib/neighbour-jobs.ts";

assert.deepEqual(neighbourRanks(1, 60), [2, 3, 4]);
assert.deepEqual(neighbourRanks(2, 60), [1, 3, 4]);
assert.deepEqual(neighbourRanks(30, 60), [29, 31, 32]);
assert.deepEqual(neighbourRanks(59, 60), [57, 58, 60]);
assert.deepEqual(neighbourRanks(60, 60), [57, 58, 59]);
assert.deepEqual(neighbourRanks(1, 1), []);
assert.deepEqual(neighbourRanks(1, 3), [2, 3]);

for (const total of [11, 60, 61]) {
  const reached = ranksReachableFrom(
    total,
    Array.from({ length: Math.min(10, total) }, (_, index) => index + 1),
  );
  assert.equal(reached.size, total, `employer of ${total}`);
}

console.log("neighbour reachability ok");
