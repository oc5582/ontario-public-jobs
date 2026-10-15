-- One row per Stripe Checkout session whose Meta Purchase event was handed to
-- the browser. The account page inserts the session id before rendering.
-- A conflict means this payment already fired, so a refresh does not fire again.
--
-- Apply this yourself (psql or the Supabase SQL editor). The app does not run it.
-- Until it is applied, Purchase still fires once per browser via localStorage,
-- and the account page logs meta_purchase_table_missing.

create table if not exists public.meta_purchase_events (
  session_id text primary key,
  created_at timestamptz not null default now()
);

comment on table public.meta_purchase_events is
  'Stripe Checkout session ids whose Meta Purchase event was already claimed.';

alter table public.meta_purchase_events enable row level security;

revoke all on table public.meta_purchase_events from public, anon, authenticated;

-- The Next.js server connects as publicjobs_app. A table created by postgres
-- is not owned by that role, so the webhook-style grant is repeated here.
-- Local Postgres may not have the role; skip the grant in that case.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'publicjobs_app') then
    execute 'alter table public.meta_purchase_events owner to publicjobs_app';
    execute 'grant select, insert, update, delete on table public.meta_purchase_events to publicjobs_app';
    execute 'drop policy if exists meta_purchase_events_app_all on public.meta_purchase_events';
    execute $pol$
      create policy meta_purchase_events_app_all
        on public.meta_purchase_events
        for all
        to publicjobs_app
        using (true)
        with check (true)
    $pol$;
  end if;
end
$$;
