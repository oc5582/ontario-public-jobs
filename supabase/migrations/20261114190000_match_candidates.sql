-- The backfill reads every description once. Give it room on a hosted database.
set statement_timeout = '10min';

-- Resume match covers every current opening, including home_hidden hospital,
-- university, and agency jobs. The anon API role has a 3s statement timeout, so
-- match_index stays on the 2026-11-14 hotfix (home_hidden = false only). The
-- Worker calls match_candidates instead: one indexed lookup scores the resume
-- against all open jobs and returns a few hundred slim rows for the AI step.
--
-- The resume is used only to build that query. It is not written to a table.
-- Apply this before deploying workers/resume-match. Until that deploy, the live
-- Worker keeps calling match_index and behaves as it does today.

create table private.job_terms (
  lexeme text not null,
  job_id uuid not null references public.jobs (id) on delete cascade,
  placement real not null,
  primary key (lexeme, job_id)
);

create index job_terms_job_idx on private.job_terms (job_id);

revoke all on table private.job_terms from public, anon, authenticated;

-- Stems that show up in almost every resume and posting. They do not separate jobs.
create or replace function private.match_stop_lexemes()
returns text[]
language sql
immutable
as $$
  select array[
    'experi','skill','work','team','abil','respons','commun','manag','includ','requir',
    'posit','role','duti','provid','environ','organ','demonstr','ensur','year','strong',
    'excel','knowledg','relat','opportun','success','collabor','individu','employ','seek',
    'previous','profession','highli','effect','task','perform','within','across','variou',
    'current','general','applic','process','time','level','well','good','new','also',
    'will','can','make','take','using','base','part','full'
  ];
$$;

create or replace function private.match_acronym_stop()
returns text[]
language sql
immutable
as $$
  select array[
    'AM','PM','OR','AND','THE','FOR','WITH','FROM','THIS','THAT','HAVE','WILL','NOT',
    'BUT','ALL','ANY','CAN','MAY','MUST','PER','VIA','INC','LLC','LTD','EST','EEO',
    'AODA','PDF','DOC','HTTP','HTTPS','WWW'
  ];
$$;

revoke all on function private.match_stop_lexemes() from public, anon, authenticated;
revoke all on function private.match_acronym_stop() from public, anon, authenticated;

-- Title hits weigh more than the same word in the posting body, so a resume that
-- says "nurse" or "service desk" surfaces those titles before a long posting that
-- only mentions the word in passing. Employer names are left out: a past employer
-- would otherwise boost every opening at that organization.
create or replace function private.job_term_rows(
  p_title text,
  p_department text,
  p_category text,
  p_alias text,
  p_description text
)
returns table (lexeme text, placement real)
language sql
stable
as $$
  with stop as (
    select private.match_stop_lexemes() as lexemes
  ),
  raw as (
    select u.lexeme, 3.0::real as placement
    from unnest(to_tsvector('english', left(coalesce(p_title, ''), 500))) as u(lexeme, positions, weights)
    where length(u.lexeme) >= 3
    union all
    select u.lexeme, 0.5::real
    from unnest(to_tsvector('english', left(concat_ws(' ',
      p_department,
      replace(coalesce(p_category, ''), '-', ' '),
      p_alias
    ), 2000))) as u(lexeme, positions, weights)
    where length(u.lexeme) >= 3
    union all
    select u.lexeme, 0.15::real
    from unnest(to_tsvector('english', left(coalesce(p_description, ''), 8000))) as u(lexeme, positions, weights)
    where length(u.lexeme) >= 3
    union all
    select lower(m[1]), 3.0::real
    from regexp_matches(coalesce(p_title, ''), '\m[A-Z][A-Z0-9]{1,5}\M', 'g') as m
    where upper(m[1]) <> all (private.match_acronym_stop())
    union all
    select lower(m[1]), 0.8::real
    from regexp_matches(left(coalesce(p_description, ''), 8000), '\m[A-Z][A-Z0-9]{1,5}\M', 'g') as m
    where upper(m[1]) <> all (private.match_acronym_stop())
  )
  select r.lexeme, max(r.placement)::real
  from raw r
  cross join stop s
  where r.lexeme ~ '^[a-z0-9]+$'
    and r.lexeme !~ '^[0-9]+$'
    and r.lexeme <> all (s.lexemes)
  group by r.lexeme;
$$;

revoke all on function private.job_term_rows(text, text, text, text, text) from public, anon, authenticated;

create or replace function private.replace_job_terms(
  p_id uuid,
  p_title text,
  p_department text,
  p_category text,
  p_alias text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  delete from private.job_terms where job_id = p_id;
  insert into private.job_terms (job_id, lexeme, placement)
  select p_id, lexeme, placement
  from private.job_term_rows(p_title, p_department, p_category, p_alias, p_description);
end;
$$;

revoke all on function private.replace_job_terms(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.jobs_refresh_match_terms()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.department is not distinct from old.department
     and new.category is not distinct from old.category
     and new.search_alias is not distinct from old.search_alias
     and new.description is not distinct from old.description
  then
    return new;
  end if;
  perform private.replace_job_terms(new.id, new.title, new.department, new.category, new.search_alias, new.description);
  return new;
end;
$$;

revoke all on function public.jobs_refresh_match_terms() from public, anon, authenticated;

drop trigger if exists jobs_match_terms_aiu on public.jobs;
create trigger jobs_match_terms_aiu
  after insert or update of title, department, category, search_alias, description
  on public.jobs
  for each row execute function public.jobs_refresh_match_terms();

-- One-time build. Reads descriptions; does not rewrite the jobs table.
insert into private.job_terms (job_id, lexeme, placement)
select j.id, t.lexeme, t.placement
from public.jobs j
cross join lateral private.job_term_rows(j.title, j.department, j.category, j.search_alias, j.description) t;

analyze private.job_terms;

-- Short slice the Worker turns into the one-line job summary. The anchor list
-- matches workers/resume-match summarize(). Postgres rejects a large {n,m}
-- repeat in substring(), so this walks the same phrases with strpos.
create or replace function private.job_match_excerpt(p_description text)
returns text
language plpgsql
immutable
as $$
declare
  flat text := regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g');
  low text := lower(flat);
  anchors text[] := array[
    'what you will do', 'what you''ll do', 'about the role', 'about this role',
    'job summary', 'position summary', 'role summary', 'purpose of the position',
    'key responsibilities', 'responsibilities', 'you will'
  ];
  phrase text;
  pos integer;
  best integer := 0;
begin
  foreach phrase in array anchors loop
    pos := strpos(low, phrase);
    if pos > 0 and (best = 0 or pos < best) then
      best := pos;
    end if;
  end loop;
  if best = 0 then
    return left(flat, 480);
  end if;
  return left(substr(flat, best, 480), 480);
end;
$$;

revoke all on function private.job_match_excerpt(text) from public, anon, authenticated;

create or replace function public.match_candidates(p_secret text, p_resume text, p_limit integer default 500)
returns json
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_limit integer;
  v_open integer;
  v_lex text[];
  v_result json;
begin
  if p_secret is null
     or encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
        <> '3af4437166489faf019cdde01061f911087ac7b0b7743eb5b4d40448798753f7' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_limit := least(800, greatest(50, coalesce(p_limit, 500)));

  select count(*)::integer into v_open
  from public.jobs j
  where j.removed_at is null
    and (j.closing_date is null or j.closing_date >= (timezone('America/Toronto', now()))::date);

  if v_open = 0 then
    return json_build_object('open_count', 0, 'jobs', '[]'::json);
  end if;

  select coalesce(array_agg(q.lexeme), '{}') into v_lex
  from (
    select s.lexeme
    from (
      select u.lexeme, count(*)::integer as tf
      from unnest(to_tsvector('english', left(coalesce(p_resume, ''), 15000))) as u(lexeme, positions, weights)
      where length(u.lexeme) >= 3
        and u.lexeme ~ '^[a-z0-9]+$'
        and u.lexeme <> all (private.match_stop_lexemes())
      group by u.lexeme
      union all
      select lower(m[1]), 2
      from regexp_matches(left(coalesce(p_resume, ''), 15000), '\m[A-Z][A-Z0-9]{1,5}\M', 'g') as m
      where upper(m[1]) <> all (private.match_acronym_stop())
    ) s
    group by s.lexeme
    order by (max(s.tf) >= 2) desc, length(s.lexeme) desc, max(s.tf) desc
    limit 48
  ) q;

  with lex as (
    select unnest(v_lex) as lexeme
  ),
  hits as (
    select t.job_id, t.lexeme, t.placement
    from lex
    join private.job_terms t on t.lexeme = lex.lexeme
    join public.jobs j on j.id = t.job_id
    where j.removed_at is null
      and (j.closing_date is null or j.closing_date >= (timezone('America/Toronto', now()))::date)
  ),
  df as (
    select h.lexeme, count(*)::numeric as df
    from hits h
    group by h.lexeme
  ),
  scored as (
    select h.job_id,
           sum(ln((v_open + 1)::numeric / (d.df + 1)) * h.placement) as score
    from hits h
    join df d on d.lexeme = h.lexeme
    group by h.job_id
  ),
  ranked as (
    select s.job_id, s.score,
           row_number() over (partition by j.employer_id order by s.score desc, j.title, j.id) as emp_rk
    from scored s
    join public.jobs j on j.id = s.job_id
  ),
  lexical as (
    select r.job_id, r.score,
           row_number() over (order by r.score desc, j.title, r.job_id) as rk
    from ranked r
    join public.jobs j on j.id = r.job_id
    where r.emp_rk <= 40
  ),
  picked as (
    select l.job_id, l.rk
    from lexical l
    where l.rk <= v_limit
  ),
  need as (
    select greatest(0, least(v_limit, 120) - (select count(*) from picked))::integer as n
  ),
  topup as (
    select j.id as job_id,
           100000 + row_number() over (order by j.closing_date nulls last, j.title, j.id) as rk
    from public.jobs j
    cross join need
    where need.n > 0
      and j.removed_at is null
      and not coalesce(j.home_hidden, false)
      and (j.closing_date is null or j.closing_date >= (timezone('America/Toronto', now()))::date)
      and not exists (select 1 from picked p where p.job_id = j.id)
    order by j.closing_date nulls last, j.title, j.id
    limit (select n from need)
  ),
  chosen as (
    select job_id, rk from picked
    union all
    select job_id, rk from topup
  )
  select json_build_object(
    'open_count', v_open,
    'jobs', coalesce((
      select json_agg(json_build_object(
        'title', j.title,
        'employer', e.name,
        'location', j.location,
        'employment_type', j.employment_type,
        'closing_date', coalesce(to_char(j.closing_date, 'YYYY-MM-DD'), ''),
        'description', private.job_match_excerpt(j.description),
        'path', j.path
      ) order by c.rk)
      from chosen c
      join public.jobs j on j.id = c.job_id
      join public.employers e on e.id = j.employer_id
    ), '[]'::json)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.match_candidates(text, text, integer) from public;
grant execute on function public.match_candidates(text, text, integer) to anon, authenticated, service_role;

-- Keep the live Worker on the small list. Returning every description here
-- timed out (57014) once hospital and campus jobs were included.
create or replace function public.match_index(p_secret text)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_secret is null
     or encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
        <> '3af4437166489faf019cdde01061f911087ac7b0b7743eb5b4d40448798753f7' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select json_agg(row_to_json(t))
    from (
      select j.title,
             e.name as employer,
             j.location,
             j.employment_type,
             coalesce(to_char(j.closing_date, 'YYYY-MM-DD'), '') as closing_date,
             left(j.description, 20000) as description,
             j.path
      from jobs j
      join employers e on e.id = j.employer_id
      where j.removed_at is null
        and not coalesce(j.home_hidden, false)
        and (j.closing_date is null or j.closing_date >= (timezone('America/Toronto', now()))::date)
    ) t
  ), '[]'::json);
end;
$$;
