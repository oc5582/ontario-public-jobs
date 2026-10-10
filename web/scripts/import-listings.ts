/**
 * Upsert data/listings.json into Postgres.
 *
 *   DATABASE_URL=postgres://... npm run import
 *
 * Uses the service connection (bypasses RLS). Safe to re-run.
 * Jobs that drop out of the feed stay in the table with in_feed = false
 * so their pages can remain up as closed.
 */
import { Client } from "pg";
import { loadJsonJobs, listingsFile, type JobRecord } from "../lib/jobs";

type EmployerRow = {
  slug: string;
  name: string;
  tier: string;
  website: string | null;
  logoUrl: string | null;
};

function employersFrom(jobs: JobRecord[]): EmployerRow[] {
  const map = new Map<string, EmployerRow>();
  for (const job of jobs) {
    const current = map.get(job.employerSlug);
    if (!current) {
      map.set(job.employerSlug, {
        slug: job.employerSlug,
        name: job.employer,
        tier: job.tier,
        website: job.website,
        logoUrl: job.logoUrl,
      });
      continue;
    }
    if (!current.website && job.website) current.website = job.website;
    if (!current.logoUrl && job.logoUrl) current.logoUrl = job.logoUrl;
    if (!current.tier && job.tier) current.tier = job.tier;
  }
  return [...map.values()];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL to the Postgres URI (direct connection, not the anon key).");
  }
  const file = listingsFile();
  const jobs = loadJsonJobs();
  if (!file || !jobs) {
    throw new Error("Could not read listings.json. Set LISTINGS_PATH or run from the repo.");
  }

  const client = new Client({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("begin");
    const employers = employersFrom(jobs);
    await client.query(
      `insert into public.employers (slug, name, tier, website, logo_url)
       select slug, name, tier, website, logo_url
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
         as t(slug, name, tier, website, logo_url)
       on conflict (slug) do update set
         name = excluded.name,
         tier = excluded.tier,
         website = coalesce(excluded.website, public.employers.website),
         logo_url = coalesce(excluded.logo_url, public.employers.logo_url),
         updated_at = now()`,
      [
        employers.map((row) => row.slug),
        employers.map((row) => row.name),
        employers.map((row) => row.tier),
        employers.map((row) => row.website),
        employers.map((row) => row.logoUrl),
      ],
    );

    await client.query(
      `insert into public.jobs (
         employer_id, employer_slug, job_slug, path, title, location, city, category,
         closing_date, posted_date, employment_type, job_types, work_mode, salary,
         salary_min_annual, salary_max_annual, department, description, apply_url,
         tier, source, fetched_at, search_text, in_feed
       )
       select e.id, t.employer_slug, t.job_slug, t.path, t.title, t.location, t.city, t.category,
              nullif(t.closing_date, '')::date, nullif(t.posted_date, '')::date,
              t.employment_type, types.job_types, t.work_mode, t.salary,
              t.salary_min, t.salary_max, t.department, t.description, t.apply_url,
              t.tier, t.source, nullif(t.fetched_at, '')::timestamptz, t.search_text, true
       from unnest(
         $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
         $8::text[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[],
         $14::numeric[], $15::numeric[], $16::text[], $17::text[], $18::text[],
         $19::text[], $20::text[], $21::text[], $22::text[]
       ) as t(
         employer_slug, job_slug, path, title, location, city, category,
         closing_date, posted_date, employment_type, job_types_text, work_mode, salary,
         salary_min, salary_max, department, description, apply_url,
         tier, source, fetched_at, search_text
       )
       cross join lateral (
         select string_to_array(t.job_types_text, '|') as job_types
       ) types
       join public.employers e on e.slug = t.employer_slug
       on conflict (apply_url) do update set
         employer_id = excluded.employer_id,
         employer_slug = excluded.employer_slug,
         job_slug = excluded.job_slug,
         path = excluded.path,
         title = excluded.title,
         location = excluded.location,
         city = excluded.city,
         category = excluded.category,
         closing_date = excluded.closing_date,
         posted_date = excluded.posted_date,
         employment_type = excluded.employment_type,
         job_types = excluded.job_types,
         work_mode = excluded.work_mode,
         salary = excluded.salary,
         salary_min_annual = excluded.salary_min_annual,
         salary_max_annual = excluded.salary_max_annual,
         department = excluded.department,
         description = excluded.description,
         tier = excluded.tier,
         source = excluded.source,
         fetched_at = excluded.fetched_at,
         search_text = excluded.search_text,
         in_feed = true,
         updated_at = now()`,
      [
        jobs.map((job) => job.employerSlug),
        jobs.map((job) => job.jobSlug),
        jobs.map((job) => job.path),
        jobs.map((job) => job.title),
        jobs.map((job) => job.location),
        jobs.map((job) => job.city),
        jobs.map((job) => job.category),
        jobs.map((job) => job.closingDate || ""),
        jobs.map((job) => job.postedDate || ""),
        jobs.map((job) => job.employmentType),
        jobs.map((job) => job.jobTypes.join("|")),
        jobs.map((job) => job.workMode),
        jobs.map((job) => job.salary),
        jobs.map((job) => job.salaryMinAnnual),
        jobs.map((job) => job.salaryMaxAnnual),
        jobs.map((job) => job.department),
        jobs.map((job) => job.description),
        jobs.map((job) => job.applyUrl),
        jobs.map((job) => job.tier),
        jobs.map((job) => job.source),
        jobs.map((job) => job.fetchedAt || ""),
        jobs.map((job) => job.searchText),
      ],
    );

    const hidden = await client.query(
      `update public.jobs
       set in_feed = false, updated_at = now()
       where apply_url <> all($1::text[])
         and in_feed = true`,
      [jobs.map((job) => job.applyUrl)],
    );
    await client.query("commit");
    console.log(
      `Imported ${jobs.length} jobs and ${employers.length} employers from ${file}. Marked ${hidden.rowCount ?? 0} missing rows out of the feed.`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
