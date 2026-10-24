-- Optional saved resume and Saturday match list for paid members.
-- The Match page still does not store a resume. This text exists only when a
-- member saves one on the account. The original file is never uploaded.
-- Apply with psql or the Supabase SQL editor. The app does not run migrations.

create table public.saved_resumes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  resume_text text not null,
  source text not null check (source in ('paste', 'pdf', 'docx')),
  filename text,
  char_count integer not null check (char_count >= 80 and char_count <= 15000),
  updated_at timestamptz not null default now(),
  constraint saved_resumes_text_len check (char_length(resume_text) between 80 and 15000),
  constraint saved_resumes_filename_len check (filename is null or char_length(filename) <= 200)
);

comment on table public.saved_resumes is
  'One parsed resume per member account. Text only. Deleted with the profile.';

create table public.weekly_match_prefs (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  opted_in boolean not null default false,
  opted_in_at timestamptz,
  unsubscribed_at timestamptz,
  consent_text text,
  unsubscribe_token text not null,
  updated_at timestamptz not null default now(),
  constraint weekly_match_prefs_token_len check (char_length(unsubscribe_token) between 20 and 128)
);

create unique index weekly_match_prefs_token_idx
  on public.weekly_match_prefs (unsubscribe_token);

comment on table public.weekly_match_prefs is
  'Opt-in for the Saturday match email. Default off. The token only turns the email off.';

create table public.weekly_match_results (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  ran_at timestamptz not null,
  week_label text not null,
  jobs jsonb not null,
  jobs_checked integer not null default 0,
  strong_count integer not null default 0,
  emailed_at timestamptz
);

comment on table public.weekly_match_results is
  'Latest Saturday list only. The next run replaces the row.';

create table public.weekly_match_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  ran_on date not null,
  outcome text not null,
  detail text,
  est_cost_usd numeric,
  created_at timestamptz not null default now()
);

create index weekly_match_log_day_idx
  on public.weekly_match_log (ran_on, outcome);

comment on table public.weekly_match_log is
  'Saturday run ledger. No resume text. A row with a null profile is a site-wide stop.';

alter table public.saved_resumes enable row level security;
alter table public.weekly_match_prefs enable row level security;
alter table public.weekly_match_results enable row level security;
alter table public.weekly_match_log enable row level security;

revoke all on table public.saved_resumes from public, anon, authenticated;
revoke all on table public.weekly_match_prefs from public, anon, authenticated;
revoke all on table public.weekly_match_results from public, anon, authenticated;
revoke all on table public.weekly_match_log from public, anon, authenticated;

grant all on table public.saved_resumes to service_role;
grant all on table public.weekly_match_prefs to service_role;
grant all on table public.weekly_match_results to service_role;
grant all on table public.weekly_match_log to service_role;

-- The Next.js server connects as publicjobs_app. authenticated has no access,
-- so a signed-in browser cannot read another member's resume through the Data API.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'publicjobs_app') then
    execute 'alter table public.saved_resumes owner to publicjobs_app';
    execute 'alter table public.weekly_match_prefs owner to publicjobs_app';
    execute 'alter table public.weekly_match_results owner to publicjobs_app';
    execute 'alter table public.weekly_match_log owner to publicjobs_app';
    execute 'grant select, insert, update, delete on table public.saved_resumes to publicjobs_app';
    execute 'grant select, insert, update, delete on table public.weekly_match_prefs to publicjobs_app';
    execute 'grant select, insert, update, delete on table public.weekly_match_results to publicjobs_app';
    execute 'grant select, insert, update, delete on table public.weekly_match_log to publicjobs_app';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'publicjobs_app') then
    execute 'drop policy if exists saved_resumes_app_all on public.saved_resumes';
    execute $pol$
      create policy saved_resumes_app_all
        on public.saved_resumes
        for all
        to publicjobs_app
        using (true)
        with check (true)
    $pol$;
    execute 'drop policy if exists weekly_match_prefs_app_all on public.weekly_match_prefs';
    execute $pol$
      create policy weekly_match_prefs_app_all
        on public.weekly_match_prefs
        for all
        to publicjobs_app
        using (true)
        with check (true)
    $pol$;
    execute 'drop policy if exists weekly_match_results_app_all on public.weekly_match_results';
    execute $pol$
      create policy weekly_match_results_app_all
        on public.weekly_match_results
        for all
        to publicjobs_app
        using (true)
        with check (true)
    $pol$;
    execute 'drop policy if exists weekly_match_log_app_all on public.weekly_match_log';
    execute $pol$
      create policy weekly_match_log_app_all
        on public.weekly_match_log
        for all
        to publicjobs_app
        using (true)
        with check (true)
    $pol$;
  end if;
end
$$;

-- Deleting the auth user cascades through profiles. supabase_auth_admin needs
-- delete on every child table that cascade touches.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant delete on table public.saved_resumes to supabase_auth_admin';
    execute 'grant delete on table public.weekly_match_prefs to supabase_auth_admin';
    execute 'grant delete on table public.weekly_match_results to supabase_auth_admin';
    execute 'grant delete on table public.weekly_match_log to supabase_auth_admin';
    execute 'drop policy if exists saved_resumes_auth_admin_delete on public.saved_resumes';
    execute $pol$
      create policy saved_resumes_auth_admin_delete
        on public.saved_resumes
        for delete
        to supabase_auth_admin
        using (true)
    $pol$;
    execute 'drop policy if exists weekly_match_prefs_auth_admin_delete on public.weekly_match_prefs';
    execute $pol$
      create policy weekly_match_prefs_auth_admin_delete
        on public.weekly_match_prefs
        for delete
        to supabase_auth_admin
        using (true)
    $pol$;
    execute 'drop policy if exists weekly_match_results_auth_admin_delete on public.weekly_match_results';
    execute $pol$
      create policy weekly_match_results_auth_admin_delete
        on public.weekly_match_results
        for delete
        to supabase_auth_admin
        using (true)
    $pol$;
    execute 'drop policy if exists weekly_match_log_auth_admin_delete on public.weekly_match_log';
    execute $pol$
      create policy weekly_match_log_auth_admin_delete
        on public.weekly_match_log
        for delete
        to supabase_auth_admin
        using (true)
    $pol$;
  end if;
end
$$;
