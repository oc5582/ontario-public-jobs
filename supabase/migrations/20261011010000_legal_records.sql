-- Agreement copies, fraud reports, alert-consent records, renewal reminders,
-- and billing rows kept after an account is deleted.
-- publicjobs_app must own these tables. It has no BYPASSRLS, and a table
-- owned by postgres with RLS and no policy rejects the app role
-- (the stripe_events failure). CREATE is granted only long enough to
-- transfer ownership, then revoked.

grant usage on schema public to publicjobs_app;
grant create on schema public to publicjobs_app;

alter table public.profiles
  add column if not exists customer_name text;

create table if not exists public.agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  email text not null,
  customer_name text,
  plan text not null,
  price_label text not null,
  terms_version text not null,
  disclosure_text text not null,
  accepted_at timestamptz not null default now(),
  stripe_session_id text,
  stripe_subscription_id text,
  amount_total_cents integer,
  amount_tax_cents integer,
  card_last4 text,
  agreement_email_sent_at timestamptz,
  agreement_email_id text
);

create index if not exists agreement_acceptances_profile_idx
  on public.agreement_acceptances (profile_id, accepted_at desc);

create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  customer_name text,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  retained_reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fraud_reports (
  id uuid primary key default gen_random_uuid(),
  job_path text,
  job_url text,
  reporter_email text,
  details text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.alert_consents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  consent_text text not null,
  page_url text not null,
  consented_at timestamptz not null default now()
);

create table if not exists public.renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null,
  period_end timestamptz not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  email_id text,
  unique (stripe_subscription_id, period_end, kind)
);

alter table public.agreement_acceptances owner to publicjobs_app;
alter table public.billing_records owner to publicjobs_app;
alter table public.fraud_reports owner to publicjobs_app;
alter table public.alert_consents owner to publicjobs_app;
alter table public.renewal_reminders owner to publicjobs_app;

revoke create on schema public from publicjobs_app;

alter table public.agreement_acceptances enable row level security;
alter table public.billing_records enable row level security;
alter table public.fraud_reports enable row level security;
alter table public.alert_consents enable row level security;
alter table public.renewal_reminders enable row level security;

revoke all on table public.agreement_acceptances from public, anon, authenticated;
revoke all on table public.billing_records from public, anon, authenticated;
revoke all on table public.fraud_reports from public, anon, authenticated;
revoke all on table public.alert_consents from public, anon, authenticated;
revoke all on table public.renewal_reminders from public, anon, authenticated;

grant select, insert, update, delete on table public.agreement_acceptances to publicjobs_app;
grant select, insert, update, delete on table public.billing_records to publicjobs_app;
grant select, insert, update, delete on table public.fraud_reports to publicjobs_app;
grant select, insert, update, delete on table public.alert_consents to publicjobs_app;
grant select, insert, update, delete on table public.renewal_reminders to publicjobs_app;

drop policy if exists agreement_acceptances_app_all on public.agreement_acceptances;
create policy agreement_acceptances_app_all
  on public.agreement_acceptances for all to publicjobs_app using (true) with check (true);

drop policy if exists billing_records_app_all on public.billing_records;
create policy billing_records_app_all
  on public.billing_records for all to publicjobs_app using (true) with check (true);

drop policy if exists fraud_reports_app_all on public.fraud_reports;
create policy fraud_reports_app_all
  on public.fraud_reports for all to publicjobs_app using (true) with check (true);

drop policy if exists alert_consents_app_all on public.alert_consents;
create policy alert_consents_app_all
  on public.alert_consents for all to publicjobs_app using (true) with check (true);

drop policy if exists renewal_reminders_app_all on public.renewal_reminders;
create policy renewal_reminders_app_all
  on public.renewal_reminders for all to publicjobs_app using (true) with check (true);

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to publicjobs_app;

create or replace function app_private.delete_auth_user(target uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  delete from auth.users where id = target;
end;
$$;

do $owner$
begin
  execute 'alter function app_private.delete_auth_user(uuid) owner to postgres';
exception
  when insufficient_privilege then
    raise notice 'delete_auth_user stays owned by the migration role';
end
$owner$;

revoke all on function app_private.delete_auth_user(uuid) from public, anon, authenticated;
grant execute on function app_private.delete_auth_user(uuid) to publicjobs_app;
