-- Quiz answers saved with a /start email signup. No resume text.
-- publicjobs_app owns the table so RLS does not reject the Next.js role.

create table if not exists public.quiz_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null check (kind in ('results', 'resume_reminder')),
  work text[] not null default '{}',
  areas text[] not null default '{}',
  salary text not null default '',
  levels text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists quiz_signups_email_idx on public.quiz_signups (email, created_at desc);

alter table public.quiz_signups enable row level security;
revoke all on table public.quiz_signups from public, anon, authenticated;
grant all on table public.quiz_signups to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'publicjobs_app') then
    execute 'alter table public.quiz_signups owner to publicjobs_app';
    execute 'grant select, insert, update, delete on table public.quiz_signups to publicjobs_app';
    execute 'drop policy if exists quiz_signups_app_all on public.quiz_signups';
    execute $pol$
      create policy quiz_signups_app_all
        on public.quiz_signups
        for all
        to publicjobs_app
        using (true)
        with check (true)
    $pol$;
  end if;
end
$$;
