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
