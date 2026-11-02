-- First-touch and last-touch ad parameters on the member row.
-- There is no separate purchases table. checkout.session.completed updates
-- profiles, which is the membership record. All columns are nullable.
-- First-touch columns are filled once (coalesce). Last-touch columns follow
-- the latest completed checkout. Apply with psql or the Supabase SQL editor.
-- The app skips the write until this migration is applied.

alter table public.profiles
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists fbclid text,
  add column if not exists gclid text,
  add column if not exists last_utm_source text,
  add column if not exists last_utm_medium text,
  add column if not exists last_utm_campaign text,
  add column if not exists last_utm_content text,
  add column if not exists last_utm_term text,
  add column if not exists last_fbclid text,
  add column if not exists last_gclid text;

comment on column public.profiles.utm_source is
  'First-touch utm_source from the landing URL. Null until a completed checkout. Not overwritten once set.';

comment on column public.profiles.last_utm_source is
  'Last-touch utm_source from the latest completed checkout. Null until then.';
