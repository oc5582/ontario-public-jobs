// Needs a local Postgres with the migrations applied (DATABASE_URL, or web/.env.local).
// Never point this at production.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const envPath = new URL("../web/.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
  }
}
const url = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error("test_applied_history_db only runs against a local DATABASE_URL");
}

const { query } = await import("../web/lib/db.ts");
const { listAppliedJobs, setApplication, lapsedApplications } = await import("../web/lib/applications.ts");

const USER = "00000000-0000-4000-8000-0000000000a1";
await query(`delete from applications where user_id = $1`, [USER]);
await query(
  `insert into profiles (id, email, membership_status) values ($1, 'applied-history@example.com', 'active')
   on conflict (id) do nothing`,
  [USER],
);

const [employer] = await query<{ id: string; slug: string; name: string }>(
  `select id, slug, name from employers order by slug limit 1`,
);
const slug = "applied-history-test-job";
const path = `/jobs/${employer.slug}/${slug}/`;
await query(`delete from jobs where path = $1`, [path]);
await query(
  `insert into jobs (employer_id, employer_slug, job_slug, path, title, page_title, meta_description, location,
                     salary, closing_date, apply_url)
   values ($1, $2, $3, $4, 'Applied History Test Clerk', 't', 'm', 'Toronto, ON', '$60,000 – $70,000',
           (timezone('America/Toronto', now()))::date + 20, 'https://example.com/apply/1')`,
  [employer.id, employer.slug, slug, path],
);
const key = `jobs/${employer.slug}/${slug}`;

assert.equal(await setApplication(USER, path, true), true);
let list = await listAppliedJobs(USER);
assert.equal(list.length, 1);
assert.equal(list[0].title, "Applied History Test Clerk");
assert.equal(list[0].employer, employer.name);
assert.equal(list[0].salary, "$60,000 – $70,000");
assert.equal(list[0].applyUrl, "https://example.com/apply/1");
assert.equal(list[0].closed, false);
assert.equal(list[0].pageExists, true);

// Daily refresh drops it from the feed.
await query(`update jobs set removed_at = now() where path = $1`, [path]);
list = await listAppliedJobs(USER);
assert.equal(list.length, 1);
assert.equal(list[0].closed, true);
assert.equal(list[0].pageExists, true);

// The job row is deleted outright: the copy survives, with no link.
await query(`delete from jobs where path = $1`, [path]);
list = await listAppliedJobs(USER);
assert.equal(list.length, 1);
assert.equal(list[0].title, "Applied History Test Clerk");
assert.equal(list[0].closed, true);
assert.equal(list[0].pageExists, false);

// Marks survive a lapsed membership (hidden by the page, not deleted).
await query(`update profiles set membership_status = 'canceled' where id = $1`, [USER]);
assert.equal((await lapsedApplications(USER)).count, 1);

// Unmarking removes the entry, even when the job row is gone.
assert.equal(await setApplication(USER, key, false), true);
assert.equal((await listAppliedJobs(USER)).length, 0);

await query(`delete from profiles where id = $1`, [USER]);
console.log("applied history db checks passed");
process.exit(0);
