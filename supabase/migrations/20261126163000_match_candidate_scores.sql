-- Scores for the quiz ranking. Same lexical formula as match_candidates
-- (title terms weigh more than body terms). No description excerpts, so the
-- quiz can attach a score without a second full candidate build inside the Worker.
-- The Worker keeps calling match_candidates. Saturday still uses Worker order.

create or replace function public.match_candidate_scores(p_secret text, p_resume text, p_limit integer default 500)
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
    return json_build_object('jobs', '[]'::json);
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
  )
  select json_build_object(
    'jobs', coalesce((
      select json_agg(json_build_object(
        'path', j.path,
        'score', round(l.score::numeric, 4)
      ) order by l.rk)
      from lexical l
      join public.jobs j on j.id = l.job_id
      where l.rk <= v_limit
    ), '[]'::json)
  )
  into v_result;

  return v_result;
end;
$$;

alter function public.match_candidate_scores(text, text, integer) set statement_timeout = '15s';

revoke all on function public.match_candidate_scores(text, text, integer) from public;
grant execute on function public.match_candidate_scores(text, text, integer) to anon, authenticated, service_role;
