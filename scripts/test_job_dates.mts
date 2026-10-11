import assert from "node:assert/strict";
import { validThrough } from "../web/lib/format.ts";

assert.equal(validThrough("2026-10-26"), "2026-10-26T23:59:59-04:00");
assert.equal(validThrough("2026-01-15"), "2026-01-15T23:59:59-05:00");
assert.equal(validThrough("2026-11-01"), "2026-11-01T23:59:59-05:00");
assert.equal(validThrough(""), "");

console.log("job dates ok");
