-- Job index for the resume match Worker.
-- The old static site served /data/listings.json and the Worker read it. The
-- Next.js site has no such file, so the Worker now calls this function through
-- the Supabase REST API (rpc/match_index) with the public anon key.
-- It returns open jobs only when p_secret is the shared MATCH_TRUSTED_SECRET, so
-- the full list stays behind the membership paywall. Only the SHA-256 of the
-- secret is stored here; the secret itself lives in the Worker and Vercel env.

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
        and (j.closing_date is null or j.closing_date >= (timezone('America/Toronto', now()))::date)
    ) t
  ), '[]'::json);
end;
$$;

revoke all on function public.match_index(text) from public;
grant execute on function public.match_index(text) to anon, authenticated, service_role;
