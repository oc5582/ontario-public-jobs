-- Cross-instance counters for public form abuse limits (login links, reports,
-- alert consent, resume match). The app hashes the key before writing it, so
-- the table holds no email address and no IP.
--
-- Until this runs, the app still limits each server instance in memory and
-- allows the request if this table is missing. Apply it yourself after review.
-- Do not apply it from CI.

grant usage on schema public to publicjobs_app;
grant create on schema public to publicjobs_app;

create table if not exists public.request_limits (
  bucket text primary key,
  hits integer not null,
  window_start timestamptz not null
);

alter table public.request_limits owner to publicjobs_app;

revoke create on schema public from publicjobs_app;

alter table public.request_limits enable row level security;

revoke all on table public.request_limits from public, anon, authenticated;

grant select, insert, update, delete on table public.request_limits to publicjobs_app;

drop policy if exists request_limits_app_all on public.request_limits;
create policy request_limits_app_all
  on public.request_limits for all to publicjobs_app using (true) with check (true);
