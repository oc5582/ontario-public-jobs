-- One free resume match per person, without an account.
--
-- match_free_runs: one row per normalised email (lowercase, trimmed, +tag removed,
-- Gmail dots removed). Holds the email as typed (lowercased), the alert consent
-- choice, when the free match ran and how many free runs that email has had.
-- A row is reserved before the Worker is called and deleted again if the match
-- fails, so a failed match does not use up the free run. No resume text is stored.
-- Rows are deleted 90 days after the last free run by the daily cron
-- /api/cron/applied-cleanup/ (web/lib/match-retention.ts).
--
-- match_free_networks: a per-network daily counter for signed-out matches.
-- net_hash is an HMAC of the IP address and the day with a server secret, so the
-- raw IP is never stored and the same network cannot be linked across days.
-- Rows older than 7 days are deleted by the same cron.
--
-- publicjobs_app owns both tables (same pattern as 20261011010000_legal_records.sql).

grant usage on schema public to publicjobs_app;
grant create on schema public to publicjobs_app;

create table if not exists public.match_free_runs (
  email_key text primary key check (char_length(email_key) between 3 and 254),
  email text not null check (char_length(email) between 3 and 254),
  alerts_consent boolean not null default false,
  source text not null default 'guest' check (source in ('guest', 'account')),
  runs integer not null default 1 check (runs >= 0),
  created_at timestamptz not null default now(),
  last_run_at timestamptz not null default now()
);

create table if not exists public.match_free_networks (
  net_hash text not null,
  used_on date not null,
  n integer not null default 0 check (n >= 0),
  primary key (net_hash, used_on)
);

alter table public.match_free_runs enable row level security;
alter table public.match_free_networks enable row level security;

revoke all on table public.match_free_runs from public, anon, authenticated;
revoke all on table public.match_free_networks from public, anon, authenticated;

alter table public.match_free_runs owner to publicjobs_app;
alter table public.match_free_networks owner to publicjobs_app;
revoke create on schema public from publicjobs_app;

grant select, insert, update, delete on table public.match_free_runs to publicjobs_app;
grant select, insert, update, delete on table public.match_free_networks to publicjobs_app;

drop policy if exists match_free_runs_app_all on public.match_free_runs;
create policy match_free_runs_app_all
  on public.match_free_runs
  for all
  to publicjobs_app
  using (true)
  with check (true);

drop policy if exists match_free_networks_app_all on public.match_free_networks;
create policy match_free_networks_app_all
  on public.match_free_networks
  for all
  to publicjobs_app
  using (true)
  with check (true);
