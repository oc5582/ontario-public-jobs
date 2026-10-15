-- A member marks a posting as applied. job_path is jobs.path with slashes trimmed
-- (jobs/{employer_slug}/{job_slug}). Signed-in users can only read and write
-- their own rows. The app role writes from the server with the signed-in user id.

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id uuid references public.jobs (id) on delete set null,
  job_path text not null check (job_path ~ '^jobs/[^/]+/[^/]+$'),
  applied_at timestamptz not null default now(),
  unique (user_id, job_path)
);

alter table public.applications enable row level security;

revoke all on table public.applications from public, anon, authenticated;

grant select, insert, update, delete on table public.applications to authenticated;
grant all on table public.applications to service_role;

drop policy if exists applications_select_own on public.applications;
create policy applications_select_own
  on public.applications
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own
  on public.applications
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists applications_update_own on public.applications;
create policy applications_update_own
  on public.applications
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists applications_delete_own on public.applications;
create policy applications_delete_own
  on public.applications
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant usage on schema public to publicjobs_app;
grant create on schema public to publicjobs_app;
alter table public.applications owner to publicjobs_app;
revoke create on schema public from publicjobs_app;

grant select, insert, update, delete, references, trigger
  on table public.applications to publicjobs_app;

drop policy if exists applications_app_all on public.applications;
create policy applications_app_all
  on public.applications
  for all
  to publicjobs_app
  using (true)
  with check (true);

do $fk$
begin
  if to_regclass('auth.users') is null then
    raise notice 'auth.users is missing; applications user cascade skipped';
    return;
  end if;

  if exists (select 1 from pg_roles where rolname = 'publicjobs_app') then
    grant usage on schema auth to publicjobs_app;
    grant references on table auth.users to publicjobs_app;
  end if;

  alter table public.applications drop constraint if exists applications_user_id_fkey;
  alter table public.applications
    add constraint applications_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant delete on table public.applications to supabase_auth_admin;
    execute 'drop policy if exists applications_auth_admin_delete on public.applications';
    execute $policy$
      create policy applications_auth_admin_delete
        on public.applications
        for delete
        to supabase_auth_admin
        using (true)
    $policy$;
  end if;
end
$fk$;
