ALTER FUNCTION public.match_candidates(p_secret text, p_resume text, p_limit integer)
  SET statement_timeout = '15s';
