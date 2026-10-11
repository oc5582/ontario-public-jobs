import assert from "node:assert/strict";
import { hasDescription } from "../web/lib/has-description.ts";

assert.equal(hasDescription({ description: "", paragraphs: [] }), false);
assert.equal(hasDescription({ description: "   ", paragraphs: [] }), false);
assert.equal(hasDescription({ description: "   ", paragraphs: ["  "] }), true);
assert.equal(hasDescription({ description: "We are hiring.", paragraphs: [] }), true);
assert.equal(hasDescription({ description: "", paragraphs: ["A paragraph."] }), true);

console.log("has description ok");
