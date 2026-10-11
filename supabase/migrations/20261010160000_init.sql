-- PublicJobs.ca phase 1 schema.
-- Apply with psql, or with the Supabase CLI (`supabase db push`) on a hosted project.
-- The Next.js server reads and writes through DATABASE_URL (the database owner / pooler).
-- The anon and authenticated Data API roles cannot read jobs. There is no bulk-select policy.

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Hosted Supabase already has service_role (with BYPASSRLS). Local Postgres
    -- creates a stand-in so the grants below succeed. The app connects as the
    -- table owner through DATABASE_URL, which bypasses RLS unless forced.
    create role service_role nologin;
  end if;
end
$$;

-- Local Postgres has no GoTrue. Hosted Supabase already provides auth.uid().
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $fn$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $fn$;
  end if;
end
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website text,
  logo_url text,
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id),
  employer_slug text not null,
  job_slug text not null,
  path text not null unique,
  title text not null,
  page_title text not null,
  meta_description text not null,
  location text not null default '',
  cities text[] not null default '{}',
  location_places jsonb not null default '[]'::jsonb,
  closing_date date,
  posted_date date,
  employment_type text not null default '',
  job_types text[] not null default '{}',
  work_mode text not null default '',
  fully_remote boolean not null default false,
  salary text not null default '',
  salary_annual_min numeric,
  salary_annual_max numeric,
  salary_currency text,
  salary_unit text,
  department text not null default '',
  description text not null default '',
  paragraphs jsonb not null default '[]'::jsonb,
  description_html text not null default '',
  apply_url text not null default '',
  tier text,
  source text,
  fetched_at timestamptz,
  external_id text,
  category text not null default 'other',
  search_alias text not null default '',
  jobposting jsonb,
  removed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (employer_slug, job_slug)
);

create index jobs_posted_idx on public.jobs (posted_date desc nulls last, fetched_at desc nulls last);
create index jobs_employer_slug_idx on public.jobs (employer_slug);
create index jobs_category_idx on public.jobs (category);
create index jobs_closing_idx on public.jobs (closing_date);
create index jobs_cities_idx on public.jobs using gin (cities);
create index jobs_types_idx on public.jobs using gin (job_types);

-- Membership is ready for Stripe. The webhook (later) is the only writer of
-- membership_status, stripe_* and current_period_end. Clients cannot update them.
create table public.profiles (
  id uuid primary key,
  email text not null unique,
  membership_status text not null default 'none'
    check (membership_status in ('none', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text check (plan is null or plan in ('month', 'quarter', 'year')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Counts for the later free/member resume-match cap. The match page still calls
-- the existing Worker directly; nothing in this phase writes these rows yet.
create table public.resume_match_usage (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  email_hash text,
  used_on date not null,
  created_at timestamptz not null default now()
);

create index resume_match_usage_profile_day_idx
  on public.resume_match_usage (profile_id, used_on);

alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.profiles enable row level security;
alter table public.resume_match_usage enable row level security;

revoke all on table public.employers from public, anon, authenticated;
revoke all on table public.jobs from public, anon, authenticated;
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.resume_match_usage from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on table public.employers to service_role;
grant all on table public.jobs to service_role;
grant all on table public.profiles to service_role;
grant all on table public.resume_match_usage to service_role;

-- Signed-in users can read their own profile. They cannot change membership.
grant select on table public.profiles to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- No SELECT/INSERT/UPDATE/DELETE policies on jobs, employers, or match usage.
-- anon and authenticated therefore cannot bulk-select jobs through the Data API.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
    execute 'create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function private.handle_new_user()';
  end if;
end
$$;
