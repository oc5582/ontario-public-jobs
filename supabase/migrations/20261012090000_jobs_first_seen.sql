-- First day we stored the job. The importer never writes this column:
-- the default fills it on insert, and leaving it out of the upsert keeps it.
-- posted_date stays the feed date. Lists sort by coalesce(posted_date, first_seen_at::date).

alter table public.jobs
  add column if not exists first_seen_at timestamptz;

update public.jobs
  set first_seen_at = coalesce(fetched_at, now())
  where first_seen_at is null;

alter table public.jobs
  alter column first_seen_at set default now();

alter table public.jobs
  alter column first_seen_at set not null;

comment on column public.jobs.first_seen_at is
  'When this row was first inserted. Not updated on later imports. Fallback posted date when the feed has none.';
