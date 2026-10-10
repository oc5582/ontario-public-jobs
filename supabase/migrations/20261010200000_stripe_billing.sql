-- Stripe webhook bookkeeping. Membership columns stay on profiles.
-- The webhook is the only writer. anon and authenticated cannot read stripe_events.

alter table public.profiles
  add column if not exists cancel_at timestamptz,
  add column if not exists billing_event_created bigint;

comment on column public.profiles.cancel_at is
  'When the subscription will stop (cancel at period end). Null while it renews.';

comment on column public.profiles.billing_event_created is
  'Unix seconds of the Stripe event that last updated membership. Older events are ignored.';

create unique index if not exists profiles_stripe_customer_id_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_uidx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

comment on table public.stripe_events is
  'Stripe webhook event ids already applied. Inserted in the same transaction as the profile update.';

alter table public.stripe_events enable row level security;

revoke all on table public.stripe_events from public, anon, authenticated;
grant all on table public.stripe_events to service_role;
