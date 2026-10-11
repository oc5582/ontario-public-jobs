-- Employer posting date, when the careers page or the feed states one.
-- posted_date stays the first day this job was collected.
-- The Next.js app still renders if this column is missing: it parses the
-- description header and otherwise uses posted_date. The importer refuses to
-- write until this migration has been applied.

alter table public.jobs
  add column if not exists employer_posted_date date;

comment on column public.jobs.employer_posted_date is
  'Date the employer posted the job, when the feed or the description header states one. posted_date remains the first day we collected it.';
