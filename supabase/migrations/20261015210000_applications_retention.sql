-- "Jobs I applied to" retention: when a membership ends, the list is hidden,
-- and the daily cron /api/cron/applied-cleanup/ deletes it 30 days later.
-- applications_hidden_since is when this account's list became hidden. The cron
-- sets it; the trigger below clears it the moment the profile grants member
-- access again, so a member who rejoins never keeps an old lapse date.
-- Rows are never deleted while membership_status = 'active' (this includes the
-- owner comp, which is active with no period end).

alter table public.profiles
  add column if not exists applications_hidden_since timestamptz;

comment on column public.profiles.applications_hidden_since is
  'When the applied list became hidden because the membership ended. Null while a member. The list is deleted 30 days after this.';

grant usage on schema public to publicjobs_app;
grant create on schema public to publicjobs_app;

create or replace function public.profiles_clear_applications_hidden()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.membership_status = 'active'
     and (new.current_period_end is null or new.current_period_end > now()) then
    new.applications_hidden_since := null;
  end if;
  return new;
end
$fn$;

alter function public.profiles_clear_applications_hidden() owner to publicjobs_app;
revoke all on function public.profiles_clear_applications_hidden() from public;

drop trigger if exists profiles_clear_applications_hidden on public.profiles;
create trigger profiles_clear_applications_hidden
  before update on public.profiles
  for each row
  execute function public.profiles_clear_applications_hidden();

alter table public.profiles owner to publicjobs_app;
revoke create on schema public from publicjobs_app;
