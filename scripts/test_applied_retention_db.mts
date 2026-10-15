// Local-only: the 30-day applied-list cleanup. Refuses any non-local DATABASE_URL.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const envPath = new URL("../web/.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
  }
}
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL || "")) {
  throw new Error("test_applied_retention_db only runs against a local DATABASE_URL");
}

const { query } = await import("../web/lib/db.ts");
const { purgeLapsedApplications } = await import("../web/lib/applied-retention.ts");
const { lapsedApplications } = await import("../web/lib/applications.ts");

const IDS = {
  lapsed29: "00000000-0000-4000-8000-0000000000b1",
  lapsed31: "00000000-0000-4000-8000-0000000000b2",
  rejoined: "00000000-0000-4000-8000-0000000000b3",
  comp: "00000000-0000-4000-8000-0000000000b4",
  staleActive: "00000000-0000-4000-8000-0000000000b5",
  refunded31: "00000000-0000-4000-8000-0000000000b6",
};
const all = Object.values(IDS);

async function reset() {
  await query(`delete from applications where user_id = any($1::uuid[])`, [all]);
  await query(`delete from profiles where id = any($1::uuid[])`, [all]);
}

async function profile(id: string, status: string, periodEnd: string | null) {
  await query(
    `insert into profiles (id, email, membership_status, current_period_end)
     values ($1, $2, $3, ${periodEnd ? `now() - interval '${periodEnd}'` : "null"})`,
    [id, `retention-${id.slice(-2)}@example.com`, status],
  );
  await query(
    `insert into applications (user_id, job_path, job_title) values ($1, $2, 'Retention test job')`,
    [id, `jobs/retention-test/${id.slice(-2)}`],
  );
}

async function marks(id: string): Promise<number> {
  const rows = await query<{ n: number }>(`select count(*)::int as n from applications where user_id = $1`, [id]);
  return rows[0].n;
}

await reset();
await profile(IDS.lapsed29, "canceled", "29 days");
await profile(IDS.lapsed31, "canceled", "31 days");
await profile(IDS.refunded31, "refunded", "31 days");
await profile(IDS.rejoined, "canceled", "40 days");
await profile(IDS.comp, "active", null); // owner comp: active, no period end
await profile(IDS.staleActive, "active", "60 days"); // webhook late: status still active

// The rejoined member's list was hidden 40 days ago, then they paid again.
await query(`update profiles set applications_hidden_since = now() - interval '40 days' where id = $1`, [IDS.rejoined]);
await query(
  `update profiles set membership_status = 'active', current_period_end = now() + interval '30 days' where id = $1`,
  [IDS.rejoined],
);
const [rejoinedRow] = await query<{ hidden: string | null }>(
  `select applications_hidden_since::text as hidden from profiles where id = $1`,
  [IDS.rejoined],
);
assert.equal(rejoinedRow.hidden, null, "the trigger clears the hidden date on rejoin");

// The lapsed-29 message names a delete date 1 day out.
const lapsed = await lapsedApplications(IDS.lapsed29);
assert.equal(lapsed.count, 1);
const daysLeft = (Date.parse(lapsed.deleteOn) - Date.now()) / 86_400_000;
assert.ok(daysLeft > 0.9 && daysLeft < 1.1, `delete date is about 1 day away (${daysLeft})`);

const first = await purgeLapsedApplications();
assert.equal(await marks(IDS.lapsed29), 1, "lapsed 29 days: kept");
assert.equal(await marks(IDS.lapsed31), 0, "lapsed 31 days: deleted");
assert.equal(await marks(IDS.refunded31), 0, "refunded 31 days: deleted");
assert.equal(await marks(IDS.rejoined), 1, "rejoined: kept");
assert.equal(await marks(IDS.comp), 1, "owner comp: kept");
assert.equal(await marks(IDS.staleActive), 1, "status active with a past period end: never deleted");
assert.ok(first.deletedRows >= 2);

// Running again is a no-op for the kept lists; the 29-day list goes once it passes 30.
await purgeLapsedApplications();
assert.equal(await marks(IDS.lapsed29), 1);
await query(`update profiles set applications_hidden_since = now() - interval '31 days' where id = $1`, [IDS.lapsed29]);
await purgeLapsedApplications();
assert.equal(await marks(IDS.lapsed29), 0, "deleted once past 30 days");
assert.equal(await marks(IDS.rejoined), 1);
assert.equal(await marks(IDS.comp), 1);

await reset();
console.log("applied retention db checks passed");
process.exit(0);
