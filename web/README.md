# PublicJobs.ca web app

Next.js App Router app that replaces the static GitHub Pages site. Phase 1
keeps the current HTML and CSS. It does not change `scripts/build_pages.py`,
`data/listings.json`, or anything `main` publishes to GitHub Pages.

On Vercel, set **Root Directory** to `web`.

## What the app does

- Job pages are public, server-rendered, and include JobPosting JSON-LD for open jobs.
- Apply is always a direct link to the employer.
- Closed jobs stay up, with a “no longer available” note and similar open jobs, and no JobPosting JSON-LD.
- List pages (home, `/jobs/`, employer pages, filtered results) return the **10 newest** openings plus the total count for logged-out visitors, then an unlock card. The rest of the jobs are not in the HTML or `/api/listings/`.
- A signed-in member with `profiles.membership_status = 'active'` gets the full filtered list from the server.
- `/jobs/page/N` and `?page=` redirect to the clean URL. They are not a public pager.
- Existing job, employer, and legacy `.html` URLs redirect with 301.
- The weekly email form posts to the existing signup Worker. Do not change that Worker from this app.
- Resume match posts to the existing Cloudflare Worker at `https://publicjobs-resume-match.publicjobs.workers.dev/match`. This app does not change that Worker.

## Local data, no Supabase required

From `web/`:

```bash
npm install
npm run dev
```

If `DATABASE_URL` and the Supabase URL are unset, the app reads `../data/listings.json`.
That file is the weekday refresh output. It is not deployed with the Vercel app
(the root is `web/`), so production needs Postgres or Supabase.

To try the member list locally without sending email, put this in `web/.env.local`
(gitignored):

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ALLOW_DEV_MEMBER=1
DEV_MEMBER_TOKEN=local-test-member
```

Open `/sign-in/` and choose **Continue as test member**. That sets an httpOnly
cookie and treats the browser as `member@example.com`. Never set
`ALLOW_DEV_MEMBER` on Vercel. The cookie does not satisfy the database
`viewer_is_member()` check. It only lifts the cap in the Next.js JSON and
`DATABASE_URL` paths.

## Supabase

1. Create a project.
2. In the SQL editor, run `supabase/migrations/20261010154604_init_publicjobs.sql`,
   or use the Supabase CLI (`supabase db push`) once the project is linked.
   The migration is written so a local Postgres can apply it too: it creates
   stub `auth.users`, `anon`, and `authenticated` only when they are missing,
   and it does not replace Supabase’s `auth.uid()`.
3. Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` (server and import only; never `NEXT_PUBLIC_`)
4. Project Settings → Database → connection string:
   - `DATABASE_URL` for the import script (direct URI).
   - The Next.js app can use either `DATABASE_URL` or the anon key. The anon
     key is the one that actually goes through row-level security.

### Row-level security

`public.jobs` has no `SELECT` grant for `anon` or `authenticated`. Clients call:

- `get_job(employer_slug, job_slug)` — one row, including the description
- `count_jobs(...)` — a number
- `list_jobs(...)` — at most 10 rows, or 5,000 if `private.viewer_is_member()` is true

Membership is `profiles.membership_status = 'active'` and `current_period_end`
null or in the future. There is no client policy that updates `profiles`.
A later Stripe webhook must use the service role.

`private` is not a PostgREST-exposed schema. The public functions are
`security invoker` wrappers. The private functions are `security definer`.

### Import

From `web/`, with `DATABASE_URL` set:

```bash
npm run import
```

This upserts employers and jobs from `data/listings.json` (14 feed fields,
plus derived city, category, job type, and salary). Rows whose `apply_url`
is missing from the latest file are kept and marked `in_feed = false`.

The weekday refresh can call this instead of committing JSON. It should use
the service role or a direct Postgres URI, not the anon key.

## Auth

Email magic link and Google both use Supabase Auth. The redirect URL is
`{origin}/auth/callback/`.

Add these to the Supabase Auth redirect allow list:

- `http://localhost:3000/auth/callback/`
- `https://<your-vercel-preview>/auth/callback/`
- `https://publicjobs.ca/auth/callback/` when you cut over

### Google

In Google Cloud Console, create an OAuth client (Web application).

Authorized redirect URI (Supabase, not the Next.js app):

`https://<project-ref>.supabase.co/auth/v1/callback`

In Supabase → Authentication → Providers → Google, paste the client id and secret.
No Google secret belongs in this repo. Leave the provider off until those
values exist. The sign-in page still shows the button and reports the
Supabase error if Google is not enabled.

Accounts are created before payment. The `auth.users` insert trigger writes
`profiles` with `membership_status = 'none'`.

## Vercel

1. Import the GitHub repo.
2. Root Directory: `web`.
3. Framework: Next.js. Build command `next build` (the default).
4. Environment variables (Preview and Production), from Supabase:

| Name | Where |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Preview URL, or `https://publicjobs.ca` in production |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API, `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API, `service_role`. Server only |
| `DATABASE_URL` | Optional if the anon key is set. Use the pooler URI for the app |

Do not set `ALLOW_DEV_MEMBER` or `DEV_MEMBER_TOKEN`.

`data/listings.json` is outside `web/`, so a preview with only the public
env vars and no database will render empty lists. Run the import before
expecting jobs.

The Meta pixel and Cloudflare analytics beacon from the live site are included
so production matches. Previews will hit those same endpoints.

## Stripe (later, not in this phase)

`/pricing/` shows:

- CA$14.99 / month
- CA$29.99 / 3 months
- CA$59 / year
- 14-day refund, cancel yourself

`lib/billing.ts` defines `BillingProvider`. `billingProvider()` throws
`BillingNotConfiguredError`. These routes return 501 until a provider exists:

- `POST /api/checkout/`
- `POST /api/billing/portal/`
- `POST /api/stripe/webhook/`

When you add Stripe, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY`, `STRIPE_PRICE_ANNUAL`.
The webhook, using the service role, is the only writer of
`membership_status`, `stripe_customer_id`, `stripe_subscription_id`,
`plan_code`, and `current_period_end`.

## Resume match, later cap

The match page still calls the current Worker. That Worker allows 3 lifetime
matches per email and IP and returns its own result list. This app does not
enforce a new cap.

Planned enforcement, not built yet:

- Free: 1 match, showing the top 5 results.
- Members: unlimited matches, with a 20-per-day cap.

`resume_match_usage` is in the migration for that counter. The match page
copy still says “Free, up to 3 times” because that is what the Worker does today.

## URLs and SEO

Indexable: `/`, `/jobs/`, `/employers/`, `/employers/{slug}/`, open job pages,
`/about/`, `/faq/`, `/privacy/`, `/terms/`, `/match/`, `/pricing/`.

Other filter combinations use query strings and `noindex`. There are no new
city hub URLs, because the live site does not have them. Employer pages are
the hubs.

`/sitemap.xml` lists those URLs and open in-feed jobs. It omits `/jobs/page/2`
and later, because those now 301 to `/jobs/`. The live sitemap still lists
them until this app replaces GitHub Pages. Closed jobs are omitted, same as
today. `robots.txt` allows `/` and points at the sitemap.

Legacy root and `jobs/*.html` meta-refresh URLs are 301s in `middleware.ts`
(`legacy-redirects.json`).

## Intentional differences from the live pages

- Public lists show 10 newest jobs (posted date, then fetched time, then title). The live site sorts by soonest closing date and paginates 25 per page.
- An unlock card replaces the pager.
- A filter bar is on the homepage, `/jobs/`, and employer pages.
- The More menu adds Pricing and Sign in. The closed header and the footer match the live site.
- Closed pages say “This job is no longer available.” and list similar open jobs. The live banner says “This job has closed.”
- About, FAQ, terms, and privacy in this app mention the optional membership. The live copies still say browsing is free with no account.
