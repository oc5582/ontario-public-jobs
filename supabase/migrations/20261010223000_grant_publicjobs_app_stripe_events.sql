-- publicjobs_app owns employers, jobs, profiles, and resume_match_usage, so
-- those writes succeed while RLS is on and there is no policy (owner bypass,
-- row security is not forced). stripe_events was created by postgres.
-- publicjobs_app has no BYPASSRLS and had no privileges on stripe_events, so
-- the webhook failed with: permission denied for table stripe_events.
-- Becoming owner requires CREATE on the schema. Grant it only for the
-- ownership change, then revoke it. Also add an RLS policy so a later owner
-- change cannot lock the app role out again, and grant sequence usage.
-- There are no sequences in public today (ids are gen_random_uuid()).

grant usage on schema public to publicjobs_app;
grant create on schema public to publicjobs_app;

alter table public.stripe_events owner to publicjobs_app;

revoke create on schema public from publicjobs_app;

grant select, insert, update, delete, truncate, references, trigger
  on table public.stripe_events to publicjobs_app;

drop policy if exists stripe_events_app_all on public.stripe_events;
create policy stripe_events_app_all
  on public.stripe_events
  for all
  to publicjobs_app
  using (true)
  with check (true);

grant select, insert, update, delete, truncate, references, trigger
  on all tables in schema public to publicjobs_app;

grant usage, select, update on all sequences in schema public to publicjobs_app;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete, truncate, references, trigger on tables
  to publicjobs_app;

alter default privileges for role postgres in schema public
  grant usage, select, update on sequences
  to publicjobs_app;
