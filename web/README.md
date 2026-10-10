# PublicJobs.ca web app

Next.js (App Router, TypeScript) for the phase-1 rebuild. The live GitHub Pages site is unchanged. This folder is meant to be deployed on Vercel with **Root Directory = `web`**.

Payments are a stub. There are no Stripe keys in this project.

## What this app does

- Job pages are public, server-rendered, and indexable. Apply is a direct link to the employer. `JobPosting` JSON-LD is included for open jobs (`directApply` is false; `baseSalary` only when the posting included pay; `sameAs` and `logo` only when those employer fields are set).
- A job whose closing date has passed, or that has left the feed, stays on its URL with “This job is no longer available.”, similar open jobs, no `JobPosting` JSON-LD, and `noindex`.
- The homepage, `/jobs/`, employer pages, and filtered lists return the newest 10 open jobs and the total for visitors. The other jobs are not in the HTML or in `/api/jobs`. `?page=2` is ignored for visitors (the page redirects back to the same list without `page`). A member gets the full filtered list.
- Filters: location, employer, category, job type, salary (annual CAD), posted since, closes by. Only the clean homepage, `/jobs/`, and `/employers/{slug}/` URLs are indexable. Any other filter combination is `noindex`.
- Old job URLs in `legacy-redirects.json` and `/jobs/page/2` (and the rest of the old paginated index) 301 to the current URL.
- `/match/` calls the existing Cloudflare Worker. This app does not change that Worker.
- The homepage email form posts to the existing signup Worker, through the same `signup.config.js`, `copy.js`, and `app.js`.

## Local setup

Postgres 16 is enough. The Supabase CLI and Docker are not required for local development. The SQL in `supabase/migrations/` is plain Postgres, plus a tiny `auth.uid()` stub when GoTrue is not installed.

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER publicjobs WITH PASSWORD 'publicjobs_local' CREATEDB CREATEROLE;"
sudo -u postgres psql -c "CREATE DATABASE publicjobs OWNER publicjobs;"
psql "postgres://publicjobs:publicjobs_local@127.0.0.1:5432/publicjobs" -f supabase/migrations/20261010160000_init.sql
psql "postgres://publicjobs:publicjobs_local@127.0.0.1:5432/publicjobs" -f supabase/seed.sql
```

`seed.sql` inserts `test@example.com` as an active yearly member. Do not run it on production.

From the repo root, with `DATABASE_URL` set:

```bash
pip install psycopg2-binary   # or apt install python3-psycopg2
DATABASE_URL=postgres://publicjobs:publicjobs_local@127.0.0.1:5432/publicjobs \
  python3 scripts/import_listings.py
```

The import reads `data/listings.json`, reuses `scripts/build_pages.py` for slugs, titles, salary, and JSON-LD, and upserts employers and jobs. It does not rewrite the JSON and it does not rebuild the GitHub Pages HTML. Paths missing from the feed get `removed_at` set. On localhost it also upserts the test member. Against any other host it does not, unless you pass `--seed-member`. Pass `--no-seed-member` to skip it even locally.

```bash
cd web
cp .env.example .env.local
# set DATABASE_URL, NEXT_PUBLIC_SITE_URL=http://localhost:3000,
# AUTH_SECRET to a long random string, and ALLOW_LOCAL_LOGIN=true
npm install
npm run dev
```

Open http://localhost:3000. Sign in at `/login/` with `test@example.com`. No email is sent. That cookie is accepted only when `ALLOW_LOCAL_LOGIN=true` and the host is `localhost` or `127.0.0.1`.

## Environment variables

Every variable is listed in `.env.example`. Never commit `.env.local` or real secrets. Do not prefix `DATABASE_URL` with `NEXT_PUBLIC_`.

| Variable | Where |
| --- | --- |
| `DATABASE_URL` | Server only. Local Postgres, or the Supabase **session pooler** URI (port 5432) with `sslmode=require`. This role must own the tables (the `postgres` user on Supabase). It is not the anon key. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for links, sitemap, JSON-LD, and `llms.txt`. Use `https://publicjobs.ca` on Vercel until the domain is switched, so a preview does not publish a second origin. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Leave blank to run without hosted Auth. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback. Never put the service role key in a `NEXT_PUBLIC_` variable. |
| `AUTH_SECRET` | Signs the local-only cookie. Required only when `ALLOW_LOCAL_LOGIN=true`. |
| `ALLOW_LOCAL_LOGIN` | `true` only on your machine. Must stay `false` or unset on Vercel. |
| `NEXT_PUBLIC_SIGNUP_ENDPOINT` | Existing signup Worker. Default is the production Worker URL. |
| `NEXT_PUBLIC_MATCH_ENDPOINT` | Existing resume-match Worker. The page script has the URL hardcoded as well, matching the live site. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Optional. Same public id as the current site. Blank omits the pixel. |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | Optional. Blank omits Cloudflare Web Analytics. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Not used yet. Do not add them until checkout is implemented. |

## Supabase (hosted)

1. Create a project. In the SQL editor, run `supabase/migrations/20261010160000_init.sql`. Do not run `supabase/seed.sql`.
2. The migration enables RLS on `employers`, `jobs`, `profiles`, and `resume_match_usage`. `anon` and `authenticated` have no `SELECT` on jobs, employers, or match usage, so the Data API cannot bulk-read the list. `authenticated` can `SELECT` its own `profiles` row. Membership columns are not client-writable. `private.handle_new_user` inserts a profile when `auth.users` exists.
3. The Next.js server connects with `DATABASE_URL` as the table owner, which bypasses RLS unless you force it. That is intentional: list queries run on the server, and the 10-job cap is applied there. Do not use the anon key as `DATABASE_URL`.
4. Authentication → URL configuration:
   - Site URL: `https://publicjobs.ca` (add the Vercel preview origin as well while you are testing).
   - Redirect URLs: `http://localhost:3000/auth/callback/` and `https://<your-vercel-host>/auth/callback/`.
5. Email magic links are on by default. The app calls `signInWithOtp` and creates the user before any payment.
6. Import the listings from a machine that has the repo and `psycopg2`:

```bash
DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require' \
  python3 scripts/import_listings.py
```

Use the session pooler (port 5432). The weekday refresh can call this script later instead of committing `listings.json`.

### Google sign-in

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Authorized JavaScript origins: `https://publicjobs.ca` and the Vercel preview origin.
4. In Supabase → Authentication → Providers → Google, turn the provider on and paste the client id and secret.
5. Add the same site origins under Authentication → URL configuration, as in the list above.
6. The sign-in page posts to `signInWithOAuth({ provider: "google" })`. Supabase sends the user back to `/auth/callback/`, which exchanges the code and then opens the account page.

## Vercel

1. Import the GitHub repository. Set **Root Directory** to `web`. Framework preset: Next.js. The free plan is enough (`next build` does not prerender job pages).
2. Environment variables for Preview and Production:

```
DATABASE_URL=<Supabase session pooler URI with sslmode=require>
NEXT_PUBLIC_SITE_URL=https://publicjobs.ca
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
ALLOW_LOCAL_LOGIN=false
NEXT_PUBLIC_SIGNUP_ENDPOINT=https://ontario-public-jobs-signup.publicjobs.workers.dev
NEXT_PUBLIC_MATCH_ENDPOINT=https://publicjobs-resume-match.publicjobs.workers.dev/match
```

Leave `AUTH_SECRET` unset on Vercel. Leave the Stripe variables unset. Add the pixel id and Cloudflare token only if you want those tags on the preview.

3. Deploy. Do not point `publicjobs.ca` at Vercel until the GitHub Pages site is ready to be retired. Cloudflare stays as DNS.
4. After the first preview URL exists, add `https://<preview>.vercel.app/auth/callback/` to the Supabase redirect allow list, and add that origin in the Google OAuth client if you test Google there.

## Stripe (later, not in this phase)

`web/lib/billing.ts` is the only place that should talk to Stripe:

- `createCheckoutSession` — Checkout in subscription mode, no trial. Success URL `/account/`, cancel URL `/pricing/`. `client_reference_id` is the profile id.
- `createPortalSession` — Customer Portal so a member can cancel without emailing.
- Webhook `POST /api/stripe/webhook` — today it returns 501 and does not write the database. When implemented, verify `STRIPE_WEBHOOK_SECRET` and update `profiles` only from `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.paid`. Never trust a membership flag sent by the browser.

`/pricing/` already shows CA$14.99/month, CA$29.99/3 months, and CA$59/year, plus the 14-day refund and self-serve cancel terms. The account is created before payment. Checkout buttons call the stub and show “Stripe Checkout is not connected yet.”

## Resume matching limits (later)

`/match/` still posts straight to `https://publicjobs-resume-match.publicjobs.workers.dev/match`. Do not change that Worker for this phase. It still enforces its own lifetime limit of 3 runs per email and per IP, including the known shared-message bug.

The table `resume_match_usage` is ready and is not written yet. The later enforcement, without changing the Worker, is a server route that:

1. Identifies the viewer (or the free email).
2. Allows a visitor 1 match and returns only the top 5 results.
3. Allows a member unlimited matches, capped at 20 per day, counted in `resume_match_usage`.
4. Then calls the existing Worker.

Until that route exists, the page copy stays “Free, up to 3 times,” because that is what the Worker still does.

## Row level security check

As the table owner, `select * from jobs` works. That is the connection the Next.js server uses. To confirm the Data API roles cannot bulk-read jobs, connect as a role that is only a member of `anon` (no `BYPASSRLS`) and run `select * from jobs`. It should fail with a permission error. Do not grant `anon` any table privileges.
