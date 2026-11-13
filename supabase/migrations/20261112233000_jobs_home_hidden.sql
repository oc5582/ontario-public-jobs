-- Jobs from the 2026-11-12 GTA hospitals + universities/colleges/agencies sources (and any future
-- source that sets "home_hidden": true in the feed) never fill the free list on the default,
-- unfiltered homepage / jobs index. Osama 2026-11-12: they show normally as soon as a keyword or
-- any filter is used, and on employer pages, job pages, search, sitemap and alerts.
-- The flag is written per job by scripts/import_listings.py from the feed field "home_hidden".
alter table public.jobs add column if not exists home_hidden boolean not null default false;
