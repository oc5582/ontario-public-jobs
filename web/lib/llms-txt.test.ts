import assert from "node:assert/strict";
import test from "node:test";
import { strengthenedEmployers } from "./employer-copy";
import { GUIDES } from "./guides";
import { LEGAL } from "./legal-config";
import { renderLlmsTxt } from "./llms-txt";

const FETCHED = "The listings on the site now were fetched between November 13, 2026 and November 19, 2026.";

test("llms.txt follows the llmstxt.org outline and skips address and phone", () => {
  const body = renderLlmsTxt({ fetched: FETCHED });
  assert.match(body, /^# PublicJobs\.ca\n\n> Independent job board/);
  assert.match(body, /gojobs\.gov\.on\.ca/);
  assert.match(body, /GC Jobs/);
  assert.match(body, /not affiliated with any government/i);
  assert.match(body, /refreshed every weekday/);
  assert.match(body, /hello@publicjobs\.ca/);
  assert.match(body, new RegExp(FETCHED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(body.includes(LEGAL.mailingAddress), false);
  assert.equal(body.includes(LEGAL.streetAddress), false);
  assert.equal(body.includes(LEGAL.phone), false);
  assert.equal(body.includes(LEGAL.phoneTel), false);
  assert.equal(body.includes("LinkedIn"), false);
  assert.equal(body.includes("Indeed"), false);
  assert.ok(body.includes("## Main pages"));
  assert.ok(body.includes("## Top employers"));
  assert.ok(body.includes("## Guides"));
  assert.ok(body.includes("## Data"));
  assert.ok(body.includes("## Optional"));
  assert.ok(body.includes("https://publicjobs.ca/data/ontario-public-jobs-november-2026/"));
  assert.ok(body.includes("https://publicjobs.ca/data/ontario-public-jobs-november-2026.md"));
  assert.ok(body.includes("https://publicjobs.ca/data/snapshot-2026-11.json"));
  assert.equal(body.includes("pending"), false);
  assert.equal(body.includes("TO BE CONFIRMED"), false);
  assert.ok(body.includes("https://publicjobs.ca/#signup-heading"));
  assert.ok(body.includes("https://publicjobs.ca/start/"));
  assert.ok(body.includes("https://publicjobs.ca/is-publicjobs-ca-legit/"));
  assert.ok(body.includes("https://publicjobs.ca/sitemap.xml"));
  for (const guide of GUIDES) {
    assert.ok(body.includes(`/guides/${guide.slug}/`), guide.slug);
    assert.ok(body.includes(guide.description), guide.slug);
  }
  const employers = strengthenedEmployers();
  assert.equal(employers.length, 10);
  for (const employer of employers) {
    assert.ok(body.includes(`/employers/${employer.slug}/`), employer.slug);
  }
  assert.equal(body.includes("university-health-network"), false);
  assert.equal(body.includes("university-of-toronto"), false);
  assert.equal(body.endsWith("\n"), true);
});
