-- Local only. Do not run this against production.
-- test@example.com is a fake address for the member-list check.
insert into public.profiles (id, email, membership_status, plan)
values (
  '00000000-0000-4000-8000-000000000001',
  'test@example.com',
  'active',
  'year'
)
on conflict (email) do update
  set membership_status = 'active',
      plan = 'year',
      updated_at = now();

-- Free account for the one-match check. Not a member.
insert into public.profiles (id, email, membership_status)
values (
  '00000000-0000-4000-8000-000000000002',
  'free-match@example.com',
  'none'
)
on conflict (email) do update
  set membership_status = 'none',
      plan = null,
      updated_at = now();
