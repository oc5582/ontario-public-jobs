# PublicJobs.ca web app

Next.js (App Router, TypeScript) for the phase-1 rebuild. The live GitHub Pages site is unchanged. This folder is meant to be deployed on Vercel with **Root Directory = `web`**.

Payments are a stub. There are no Stripe keys in this project.

## What this app does

- Job pages are public, server-rendered, and indexable. Apply is a direct link to the employer. `JobPosting` JSON-LD is included for open jobs (`directApply` is false; `baseSalary` only when the posting included pay; `sameAs` and `logo` only when those employer fields are set).
- A job whose closing date has passed, or that has left the feed, stays on its URL with “This job is no longer available.”, similar open jobs, no `JobPosting` JSON-LD, and `noindex`.
- The homepage, `/jobs/`, employer pages, and filtered lists return the newest 10 open jobs and the total for visitors. The other jobs are not in the HTML or in `/api/jobs`. `?page=2` is ignored for visitors (the page redirects back to the same list without `page`). A member gets the full filtered list.
- Filters: location, employer, category, job type, salary (annual CAD), posted since, closes by. Only the clean homepage, `/jobs/`, and `/employers/{slug}/` URLs are indexable. Any other filter combination is `noindex`.
- Old job URLs in `legacy-redirects.json` and `/jobs/page/2` (and the rest of the old paginated index) 301 to the current URL.
- `/match/` requires a signed-in account. The server counts uses in `resume_match_usage` and calls the resume-match Worker only when `MATCH_TRUSTED_SECRET` is set. The weekly email form still posts to the existing signup Worker.
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

Open http://localhost:3000. Sign in at `/login/` with `test@example.com` (member) or `free-match@example.com` (one free match). No email is sent. That cookie is accepted only when `ALLOW_LOCAL_LOGIN=true` and the host is `localhost` or `127.0.0.1`.

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
| `MATCH_WORKER_URL` | Server only. Resume-match Worker URL. The browser does not call it. |
| `MATCH_TRUSTED_SECRET` | Server only. Shared with the Worker secret of the same name. Empty means `/match/` will not call the Worker. Never commit the value. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Optional. Same public id as the current site. Blank omits the pixel. |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | Optional. Blank omits Cloudflare Web Analytics. |
| `STRIPE_SECRET_KEY` | Server only. Stripe secret key. Use the test key until you switch the site live. Never `NEXT_PUBLIC_`. |
| `STRIPE_WEBHOOK_SECRET` | Server only. Signing secret for `POST /api/stripe/webhook/`. |
| `STRIPE_PRICE_MONTHLY` | Server only. Price id for CA$14.99 per month. |
| `STRIPE_PRICE_QUARTERLY` | Server only. Price id for CA$29.99 every 3 months. |
| `STRIPE_PRICE_YEARLY` | Server only. Price id for CA$59 per year. |

## Supabase (hosted)

1. Create a project. In the SQL editor, run `supabase/migrations/20261010160000_init.sql`, then `supabase/migrations/20261010200000_stripe_billing.sql`. Do not run `supabase/seed.sql`.
2. The migrations enable RLS on `employers`, `jobs`, `profiles`, `resume_match_usage`, and `stripe_events`. `anon` and `authenticated` have no `SELECT` on jobs, employers, match usage, or Stripe event ids, so the Data API cannot bulk-read the list. `authenticated` can `SELECT` its own `profiles` row. Membership columns are not client-writable. `private.handle_new_user` inserts a profile when `auth.users` exists.
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
MATCH_WORKER_URL=https://publicjobs-resume-match.publicjobs.workers.dev/match
MATCH_TRUSTED_SECRET=<same value as the Worker secret; leave empty until that Worker is deployed>
STRIPE_SECRET_KEY=<sk_test_... until go-live>
STRIPE_WEBHOOK_SECRET=<signing secret for /api/stripe/webhook/>
STRIPE_PRICE_MONTHLY=<price id, CA$14.99/month>
STRIPE_PRICE_QUARTERLY=<price id, CA$29.99 every 3 months>
STRIPE_PRICE_YEARLY=<price id, CA$59/year>
```

Leave `AUTH_SECRET` unset on Vercel. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY`, and `STRIPE_PRICE_YEARLY` on Preview and Production. Do not add a `NEXT_PUBLIC_` Stripe key. Checkout is hosted, so the browser never sees the secret key. Add the pixel id and Cloudflare token only if you want those tags on the preview.

3. Deploy. Do not point `publicjobs.ca` at Vercel until the GitHub Pages site is ready to be retired. Cloudflare stays as DNS.
4. After the first preview URL exists, add `https://<preview>.vercel.app/auth/callback/` to the Supabase redirect allow list, and add that origin in the Google OAuth client if you test Google there.

## Stripe

Checkout and the customer portal run in test mode until `STRIPE_SECRET_KEY` is a live key. The browser never talks to Stripe directly. There is no publishable key.

- Account first. `/pricing/` sends a signed-out visitor to `/login/?next=/pricing/`. Checkout is refused without a profile.
- `createCheckoutSession` creates a Stripe customer, stores `profiles.stripe_customer_id`, then opens hosted Checkout (`mode=subscription`) for `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY`, or `STRIPE_PRICE_YEARLY`. No trial, no promotion codes, no optional items. Success returns to `/account/?checkout=success`. Cancel returns to `/pricing/`.
- `createPortalSession` opens the Customer Portal on the account’s default configuration (cancel at period end, switch plan, update card, invoices). Return URL is `/account/`.
- Webhook `POST /api/stripe/webhook/` (trailing slash, because the no-slash path 308s and Stripe does not follow redirects). Verify `STRIPE_WEBHOOK_SECRET` against the raw body. The route is outside middleware, so it is not part of session refresh. `?x-vercel-protection-bypass=` may be present; the handler ignores it.
- Handled events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Each event id is inserted into `stripe_events` in the same transaction as the profile update. A repeat is a no-op. An older `event.created` does not overwrite a newer one. A different subscription does not cancel an active one.
- `membership_status=active` with `current_period_end` still in the future opens the full lists and the member match limit. `past_due` and `canceled` do not. Cancel at period end stays `active` until `cancel_at`, and the account page says when it cancels. A renewing plan shows the renewal date.
- The 14-day refund is still a manual Stripe dashboard refund. The pricing page copy for that policy is unchanged.
- Prices must not include a free trial. A `trialing` subscription is not treated as a member.

```bash
node --import ./scripts/register-ts.mjs --experimental-strip-types scripts/test_stripe_billing.mts
```

## Resume matching

`/match/` posts to `POST /api/match/` on this app. The route requires a signed-in account.

- A free account (`membership_status` is not `active`) gets 1 match. The response keeps the top 5 jobs. The page shows an unlock card for the rest, linking to `/pricing/`.
- An active member gets 20 matches per day, dated in America/Toronto. The next one returns “You've hit today's member limit. Try again tomorrow.”
- A second free match returns “You've used your free match.” with a link to `/pricing/`.
- A failed Worker call, a partial batch, or a crash does not insert a `resume_match_usage` row.
- The weekly email is sent only when the checkbox is checked. The route forwards that choice to the Worker. It does not call the signup Worker itself.
- Which limit fired is logged as JSON: `{ "event": "resume_match_limit", "limit": "free_used" | "member_daily" | "worker_daily" | "worker_spend" | "worker_ip" | "worker_person" }`.

The server calls `MATCH_WORKER_URL` with header `X-PublicJobs-Trusted: $MATCH_TRUSTED_SECRET`. That header skips the Worker's per-email and per-IP counters. The Worker still enforces its daily cap and monthly AI spend cap. If the secret or the URL is empty, the route returns “Resume matching is not available right now” and does not call the Worker. That avoids the Worker that is live today, which still counts 3 lifetime uses per IP.

The Worker source to deploy later is `workers/resume-match/`. Do not deploy it as part of shipping this app. See that folder's README for the secret and the deploy command. Direct calls (the current publicjobs.ca `/match/` page) keep working if that source is deployed first: 3 lifetime matches per email, 10 per network per day, separate messages, signup only after the checks, and no charge when matching fails.

```bash
node --import ./scripts/register-ts.mjs --experimental-strip-types scripts/test_match_limits.mts
node workers/resume-match/worker.test.mjs
```

## Row level security check

As the table owner, `select * from jobs` works. That is the connection the Next.js server uses. To confirm the Data API roles cannot bulk-read jobs, connect as a role that is only a member of `anon` (no `BYPASSRLS`) and run `select * from jobs`. It should fail with a permission error. Do not grant `anon` any table privileges.
