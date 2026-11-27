import assert from "node:assert/strict";
import test from "node:test";
import { parseMatchJobParam } from "./match-focus";

const ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

test("match job query accepts an id or an employer and slug", () => {
  assert.deepEqual(parseMatchJobParam(ID), { id: ID });
  assert.deepEqual(parseMatchJobParam(`  /jobs/town-of-oakville/administrative-assistant/ `), {
    employer: "town-of-oakville",
    slug: "administrative-assistant",
  });
  assert.deepEqual(parseMatchJobParam("https://publicjobs.ca/jobs/town-of-oakville/administrative-assistant/?utm=1"), {
    employer: "town-of-oakville",
    slug: "administrative-assistant",
  });
  assert.equal(parseMatchJobParam(""), null);
  assert.equal(parseMatchJobParam("administrative-assistant"), null);
  assert.equal(parseMatchJobParam("../secret"), null);
  assert.equal(parseMatchJobParam("town-of-oakville/admin assistant"), null);
});
