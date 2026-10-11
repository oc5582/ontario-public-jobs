-- A full refund ends the membership. "refunded" is not "canceled": a later
-- subscription.deleted event must not overwrite it, and the account can say
-- the membership ended because the charge was refunded.
alter table public.profiles drop constraint profiles_membership_status_check;

alter table public.profiles
  add constraint profiles_membership_status_check
  check (membership_status in ('none', 'active', 'past_due', 'canceled', 'refunded'));
