import assert from "node:assert/strict";
import test from "node:test";
import { closingSoonPhrase, daysUntilClosing } from "./format";

const TODAY = "2026-11-27";

test("closing phrase is only today through 14 days, in Toronto calendar days", () => {
  assert.equal(closingSoonPhrase("2026-11-27", TODAY), "Closes today");
  assert.equal(closingSoonPhrase("2026-11-28T23:59:59-05:00", TODAY), "Closes tomorrow");
  assert.equal(closingSoonPhrase("2026-11-29", TODAY), "Closes in 2 days");
  assert.equal(closingSoonPhrase("2026-12-11", TODAY), "Closes in 14 days");
  assert.equal(closingSoonPhrase("2026-12-12", TODAY), "");
  assert.equal(closingSoonPhrase("2026-11-26", TODAY), "");
  assert.equal(closingSoonPhrase("", TODAY), "");
  assert.equal(closingSoonPhrase("not-a-date", TODAY), "");
  assert.equal(closingSoonPhrase("2026-11-27", ""), "");
  assert.equal(daysUntilClosing("2026-12-11", TODAY), 14);
});
