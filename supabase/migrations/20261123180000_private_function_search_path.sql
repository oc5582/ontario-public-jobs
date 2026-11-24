-- Supabase security advisor: function_search_path_mutable on four private
-- helpers that were created without a fixed search_path. This only pins the
-- path. It does not change the function bodies.
--
-- Not applied by the security-hardening change. Review and run it yourself
-- (Supabase SQL editor or `supabase db push`). Do not apply it from CI.

alter function private.match_stop_lexemes() set search_path = pg_catalog, pg_temp;
alter function private.match_acronym_stop() set search_path = pg_catalog, pg_temp;
alter function private.job_term_rows(text, text, text, text, text) set search_path = pg_catalog, public, private, pg_temp;
alter function private.job_match_excerpt(text) set search_path = pg_catalog, pg_temp;
