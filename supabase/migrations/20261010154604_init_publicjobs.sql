-- PublicJobs.ca phase 1 schema.
create extension if not exists pgcrypto;
-- Anon and authenticated roles cannot bulk-select jobs. They can call
-- the public functions below, which return one job, a count, or at most
-- 10 rows unless the signed-in profile has an active membership.

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
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
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $fn$;
  end if;
end $$;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres;

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tier text not null default '',
  website text,
  logo_url text,
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete cascade,
  employer_slug text not null,
  job_slug text not null,
  path text not null unique,
  title text not null,
  location text not null default '',
  city text not null default '',
  category text not null default 'Other',
  closing_date date,
  posted_date date,
  employment_type text not null default '',
  job_types text[] not null default '{}',
  work_mode text not null default '',
  salary text not null default '',
  salary_min_annual numeric,
  salary_max_annual numeric,
  department text not null default '',
  description text not null default '',
  apply_url text not null unique,
  tier text not null default '',
  source text not null default '',
  fetched_at timestamptz,
  search_text text not null default '',
  in_feed boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (employer_slug, job_slug)
);

create index jobs_list_order_idx
  on public.jobs (posted_date desc nulls last, fetched_at desc nulls last, title);
create index jobs_employer_slug_idx on public.jobs (employer_slug);
create index jobs_city_idx on public.jobs (city);
create index jobs_category_idx on public.jobs (category);
create index jobs_closing_idx on public.jobs (closing_date);
create index jobs_open_feed_idx on public.jobs (in_feed, closing_date);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  -- none | trialing | active | past_due | canceled
  membership_status text not null default 'none'
    check (membership_status in ('none', 'trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  -- monthly | quarterly | annual, set by the Stripe webhook later
  plan_code text
    check (plan_code is null or plan_code in ('monthly', 'quarterly', 'annual')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resume_match_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email_hash text,
  ip_hash text,
  match_date date not null default (timezone('utc', now()))::date,
  shown_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index resume_match_user_day_idx
  on public.resume_match_usage (user_id, match_date);
create index resume_match_email_day_idx
  on public.resume_match_usage (email_hash, match_date);

alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.profiles enable row level security;
alter table public.resume_match_usage enable row level security;

revoke all on table public.jobs from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.resume_match_usage from anon, authenticated;
revoke all on table public.employers from anon, authenticated;

grant select on table public.employers to anon, authenticated;
create policy employers_public_read
  on public.employers
  for select
  to anon, authenticated
  using (true);

grant select on table public.profiles to authenticated;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

grant select on table public.resume_match_usage to authenticated;
create policy resume_match_select_own
  on public.resume_match_usage
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policies. Membership is written by the service role
-- (Stripe webhook, later). Clients cannot promote themselves.

create or replace function private.viewer_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and membership_status = 'active'
      and (current_period_end is null or current_period_end > now())
  );
$$;

create or replace function private.job_is_open(closing date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select closing is null or closing >= (timezone('America/Toronto', now()))::date;
$$;

create or replace function private.list_jobs(
  p_q text,
  p_location text,
  p_employer text,
  p_category text,
  p_job_type text,
  p_salary_min numeric,
  p_posted_after date,
  p_closing_after date,
  p_closing_before date
)
returns table (
  title text,
  employer text,
  employer_slug text,
  job_slug text,
  path text,
  location text,
  city text,
  category text,
  closing_date date,
  posted_date date,
  employment_type text,
  salary text,
  work_mode text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lim integer;
  needle text;
begin
  if private.viewer_is_member() then
    lim := 5000;
  else
    lim := 10;
  end if;

  needle := nullif(lower(btrim(coalesce(p_q, ''))), '');

  return query
  select
    j.title,
    e.name,
    j.employer_slug,
    j.job_slug,
    j.path,
    j.location,
    j.city,
    j.category,
    j.closing_date,
    j.posted_date,
    j.employment_type,
    j.salary,
    j.work_mode
  from public.jobs j
  join public.employers e on e.id = j.employer_id
  where j.in_feed
    and private.job_is_open(j.closing_date)
    and (needle is null or position(needle in j.search_text) > 0)
    and (nullif(btrim(coalesce(p_location, '')), '') is null or j.city = btrim(p_location))
    and (nullif(btrim(coalesce(p_employer, '')), '') is null or j.employer_slug = btrim(p_employer))
    and (nullif(btrim(coalesce(p_category, '')), '') is null or j.category = btrim(p_category))
    and (
      nullif(btrim(coalesce(p_job_type, '')), '') is null
      or btrim(p_job_type) = any (j.job_types)
    )
    and (
      p_salary_min is null
      or j.salary_max_annual >= p_salary_min
      or (j.salary_max_annual is null and j.salary_min_annual >= p_salary_min)
    )
    and (p_posted_after is null or j.posted_date >= p_posted_after)
    and (p_closing_after is null or j.closing_date >= p_closing_after)
    and (p_closing_before is null or j.closing_date <= p_closing_before)
  order by j.posted_date desc nulls last, j.fetched_at desc nulls last, j.title asc
  limit lim;
end;
$$;

create or replace function private.count_jobs(
  p_q text,
  p_location text,
  p_employer text,
  p_category text,
  p_job_type text,
  p_salary_min numeric,
  p_posted_after date,
  p_closing_after date,
  p_closing_before date
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  total bigint;
  needle text;
begin
  needle := nullif(lower(btrim(coalesce(p_q, ''))), '');
  select count(*) into total
  from public.jobs j
  where j.in_feed
    and private.job_is_open(j.closing_date)
    and (needle is null or position(needle in j.search_text) > 0)
    and (nullif(btrim(coalesce(p_location, '')), '') is null or j.city = btrim(p_location))
    and (nullif(btrim(coalesce(p_employer, '')), '') is null or j.employer_slug = btrim(p_employer))
    and (nullif(btrim(coalesce(p_category, '')), '') is null or j.category = btrim(p_category))
    and (
      nullif(btrim(coalesce(p_job_type, '')), '') is null
      or btrim(p_job_type) = any (j.job_types)
    )
    and (
      p_salary_min is null
      or j.salary_max_annual >= p_salary_min
      or (j.salary_max_annual is null and j.salary_min_annual >= p_salary_min)
    )
    and (p_posted_after is null or j.posted_date >= p_posted_after)
    and (p_closing_after is null or j.closing_date >= p_closing_after)
    and (p_closing_before is null or j.closing_date <= p_closing_before);
  return total;
end;
$$;

create or replace function private.get_job(p_employer_slug text, p_job_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(row)
  from (
    select
      j.title,
      e.name as employer,
      j.employer_slug,
      j.job_slug,
      j.path,
      j.location,
      j.city,
      j.category,
      j.closing_date,
      j.posted_date,
      j.employment_type,
      j.job_types,
      j.work_mode,
      j.salary,
      j.salary_min_annual,
      j.salary_max_annual,
      j.department,
      j.description,
      j.apply_url,
      j.tier,
      j.source,
      j.fetched_at,
      j.in_feed,
      e.website,
      e.logo_url
    from public.jobs j
    join public.employers e on e.id = j.employer_id
    where j.employer_slug = p_employer_slug
      and j.job_slug = p_job_slug
    limit 1
  ) row;
$$;

create or replace function public.list_jobs(
  p_q text default null,
  p_location text default null,
  p_employer text default null,
  p_category text default null,
  p_job_type text default null,
  p_salary_min numeric default null,
  p_posted_after date default null,
  p_closing_after date default null,
  p_closing_before date default null
)
returns table (
  title text,
  employer text,
  employer_slug text,
  job_slug text,
  path text,
  location text,
  city text,
  category text,
  closing_date date,
  posted_date date,
  employment_type text,
  salary text,
  work_mode text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_jobs(
    p_q, p_location, p_employer, p_category, p_job_type,
    p_salary_min, p_posted_after, p_closing_after, p_closing_before
  );
$$;

create or replace function public.count_jobs(
  p_q text default null,
  p_location text default null,
  p_employer text default null,
  p_category text default null,
  p_job_type text default null,
  p_salary_min numeric default null,
  p_posted_after date default null,
  p_closing_after date default null,
  p_closing_before date default null
)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select private.count_jobs(
    p_q, p_location, p_employer, p_category, p_job_type,
    p_salary_min, p_posted_after, p_closing_after, p_closing_before
  );
$$;

create or replace function public.get_job(p_employer_slug text, p_job_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_job(p_employer_slug, p_job_slug);
$$;

revoke all on function private.viewer_is_member() from public, anon, authenticated;
revoke all on function private.job_is_open(date) from public, anon, authenticated;
revoke all on function private.list_jobs(text, text, text, text, text, numeric, date, date, date) from public;
revoke all on function private.count_jobs(text, text, text, text, text, numeric, date, date, date) from public;
revoke all on function private.get_job(text, text) from public;
grant execute on function private.list_jobs(text, text, text, text, text, numeric, date, date, date) to anon, authenticated;
grant execute on function private.count_jobs(text, text, text, text, text, numeric, date, date, date) to anon, authenticated;
grant execute on function private.get_job(text, text) to anon, authenticated;

revoke all on function public.list_jobs(text, text, text, text, text, numeric, date, date, date) from public;
revoke all on function public.count_jobs(text, text, text, text, text, numeric, date, date, date) from public;
revoke all on function public.get_job(text, text) from public;
grant execute on function public.list_jobs(text, text, text, text, text, numeric, date, date, date) to anon, authenticated;
grant execute on function public.count_jobs(text, text, text, text, text, numeric, date, date, date) to anon, authenticated;
grant execute on function public.get_job(text, text) to anon, authenticated;

grant usage on schema private to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

comment on table public.jobs is
  'Job rows. Anon cannot select this table. Use public.get_job, public.list_jobs (max 10 unless member), and public.count_jobs.';
comment on table public.profiles is
  'Member profile. membership_status is for Stripe later. Clients cannot update it.';
comment on table public.resume_match_usage is
  'Future resume-match counters. Free: 1 match, top 5. Members: 20 per day. Not enforced in phase 1; the Cloudflare Worker still applies its own cap.';
