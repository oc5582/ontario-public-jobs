-- Idempotent free matches: the browser sends a run id with each submit. The claimed
-- row stores it, and a resent copy of the same submit (same email and run id within
-- 5 minutes) is treated as the same run: it is not counted again and does not take a
-- network slot. run_id_repeats caps how often one run id can be repeated.
-- Additive and nullable; existing rows are unaffected. Table owner stays publicjobs_app.

alter table public.match_free_runs
  add column if not exists run_id text check (run_id is null or char_length(run_id) between 8 and 80),
  add column if not exists run_id_at timestamptz,
  add column if not exists run_id_repeats integer not null default 0 check (run_id_repeats >= 0);
