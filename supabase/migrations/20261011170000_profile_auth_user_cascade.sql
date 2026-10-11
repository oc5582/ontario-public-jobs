-- Deleting an auth user directly removes the profile.
-- publicjobs_app owns profiles (no BYPASSRLS). It needs an explicit grant
-- and a policy so a later owner change cannot block the cascade, plus
-- REFERENCES on auth.users so the foreign key is valid for that owner.
-- supabase_auth_admin is who the Supabase dashboard uses to delete a user.
-- That role does not own profiles and does not bypass row security, so the
-- cascade also needs a delete grant and policy on every table the delete touches.

grant select, insert, update, delete, references, trigger
  on table public.profiles to publicjobs_app;

drop policy if exists profiles_app_all on public.profiles;
create policy profiles_app_all
  on public.profiles
  for all
  to publicjobs_app
  using (true)
  with check (true);

grant select, insert, update, delete on table public.resume_match_usage to publicjobs_app;

drop policy if exists resume_match_usage_app_all on public.resume_match_usage;
create policy resume_match_usage_app_all
  on public.resume_match_usage
  for all
  to publicjobs_app
  using (true)
  with check (true);

do $fk$
begin
  if to_regclass('auth.users') is null then
    raise notice 'auth.users is missing; profile cascade foreign key skipped';
    return;
  end if;

  if exists (select 1 from pg_roles where rolname = 'publicjobs_app') then
    grant usage on schema auth to publicjobs_app;
    grant references on table auth.users to publicjobs_app;
  end if;

  alter table public.profiles drop constraint if exists profiles_id_fkey;
  alter table public.profiles
    add constraint profiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade;

  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant delete on table public.profiles to supabase_auth_admin;
    grant delete on table public.resume_match_usage to supabase_auth_admin;
    grant update on table public.agreement_acceptances to supabase_auth_admin;
    execute 'drop policy if exists profiles_auth_admin_delete on public.profiles';
    execute $policy$
      create policy profiles_auth_admin_delete
        on public.profiles
        for delete
        to supabase_auth_admin
        using (true)
    $policy$;
    execute 'drop policy if exists resume_match_usage_auth_admin_delete on public.resume_match_usage';
    execute $policy$
      create policy resume_match_usage_auth_admin_delete
        on public.resume_match_usage
        for delete
        to supabase_auth_admin
        using (true)
    $policy$;
    execute 'drop policy if exists agreement_acceptances_auth_admin_update on public.agreement_acceptances';
    execute $policy$
      create policy agreement_acceptances_auth_admin_update
        on public.agreement_acceptances
        for update
        to supabase_auth_admin
        using (true)
        with check (true)
    $policy$;
  end if;
end
$fk$;
