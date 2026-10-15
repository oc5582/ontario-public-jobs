-- "Jobs I applied to" keeps each mark readable after the posting leaves the
-- board. The importer only sets jobs.removed_at, but a job row can still be
-- edited or deleted later, so the mark carries its own copy of the key details
-- taken when the member marked it. Undoing the mark deletes the row and the copy.
-- Deleting the sign-in account still cascades (applications_user_id_fkey).
-- job_id stays "on delete set null", so a deleted job never deletes a mark.

alter table public.applications
  add column if not exists job_title text not null default '',
  add column if not exists employer_name text not null default '',
  add column if not exists job_location text not null default '',
  add column if not exists location_places jsonb not null default '[]'::jsonb,
  add column if not exists salary text not null default '',
  add column if not exists closing_date date,
  add column if not exists apply_url text not null default '';

comment on column public.applications.job_title is
  'Copy of jobs.title when the member marked it applied. Kept if the job leaves the board.';
comment on column public.applications.apply_url is
  'Copy of jobs.apply_url (the employer posting) when the member marked it applied.';

-- Fill the copy for marks made before this migration.
update public.applications a
set job_title = j.title,
    employer_name = e.name,
    job_location = j.location,
    location_places = j.location_places,
    salary = j.salary,
    closing_date = j.closing_date,
    apply_url = j.apply_url,
    job_id = j.id
from public.jobs j
join public.employers e on e.id = j.employer_id
where a.job_title = ''
  and (a.job_id = j.id or (a.job_id is null and btrim(j.path, '/') = a.job_path));

-- Newest-first list per member.
create index if not exists applications_user_applied_at_idx
  on public.applications (user_id, applied_at desc);

-- Keep the app role as owner. The new index belongs to the table owner. The
-- ownership pattern is repeated so a fresh database ends in the same state.
grant usage on schema public to publicjobs_app;
grant create on schema public to publicjobs_app;
alter table public.applications owner to publicjobs_app;
revoke create on schema public from publicjobs_app;
