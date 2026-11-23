# Resume match Worker

Source for the `publicjobs-resume-match` Cloudflare Worker. This folder is the copy to deploy. **Do not deploy it from this change.** The live Worker stays as it is until you choose to publish this source.

The Next.js app does not call this Worker until `MATCH_TRUSTED_SECRET` is set on the server. While that variable is empty, `/match/` will not hit the Worker that is live today.

## What changed

Direct callers (the current publicjobs.ca `/match/` page, if this Worker is deployed before the site switches):

- An email still gets 3 matches, for life. The message is still “You have used your 3 free resume matches.”
- A network gets 10 matches per UTC day, not 3 for life. The message is separate: “Resume matching from this network is busy today. Please try again tomorrow.”
- The weekly email signup runs only after those checks pass, and only when the consent box was checked. A blocked match does not subscribe the address.
- Addresses at example.com, example.net, example.org, and resend.dev are never subscribed.
- A failed AI run, including a partial batch failure or a crash, gives the use back. Spend is still recorded when tokens were used, so the monthly cap stays honest.

Trusted callers (the Next.js server) send header `X-PublicJobs-Trusted` with the shared secret:

- Per-email and per-IP counters are skipped. The app counts uses in `resume_match_usage`.
- The site-wide daily cap (300 per UTC day) and the monthly AI spend cap still apply. The cap defaults to $10. Set `MATCH_MONTHLY_CAP_USD` only to change it.
- Consent is optional. The address is subscribed only when `casl_consent` is yes.

The response shape is unchanged: `{ ok, error, strong, maybe, jobs_checked, remaining }`. `remaining` is null for trusted callers. `partial` is false on success. A partial AI failure is an error, not a partial result.

Trusted callers may send `match_mode: "tight"` for the Saturday member list. That uses a stricter prompt (strong fits only; leave a job out when unsure) and drops any `maybe` the model still returns. Direct callers cannot turn that mode on. The Next.js app also filters the response, so the weekly list stays tighter even before this Worker source is deployed. Do not deploy this Worker as part of shipping the weekly feature.

## Job index

Matching uses every current opening, including `home_hidden` hospital, university, and agency jobs. The Worker sends the resume to `public.match_candidates` (migration `supabase/migrations/20261114190000_match_candidates.sql`) through the REST API (`/rest/v1/rpc/match_candidates`) with the public publishable key and its `MATCH_TRUSTED_SECRET` as `p_secret`. The function refuses any other value (it stores only the SHA-256 of the secret). If the secret is rotated, update the hash in that function and in `match_index`.

The function does not return the whole catalogue. A term index (`private.job_terms`) scores the resume against every open job and returns the top 500 (40 per employer), with a short description excerpt. That list is what the model ranks. `jobs_checked` in the response is the number of open jobs considered, not the size of the list sent to the model. The resume is not stored.

`match_index` stays limited to `home_hidden = false`. The Worker that is already deployed still calls it. Pointing that function at every job timed out (Postgres `57014`) under the anon role's 3 second limit. Do not widen it.

There is no hour-long cache. Each match asks for its own candidates. Job links use the `path` stored in the database.

## Env

| Name | Where | Notes |
| --- | --- | --- |
| `MATCH_TRUSTED_SECRET` | Worker secret and Vercel server env | Same long random string on both sides. Not a `NEXT_PUBLIC_` variable. Never commit the value. |
| `MATCH_WORKER_URL` | Vercel server env only | `https://publicjobs-resume-match.publicjobs.workers.dev/match` |
| `MATCH_DAILY_CAP` | Optional Worker var | Overrides the 300/day cap. Leave unset in production. |
| `MATCH_MONTHLY_CAP_USD` | Optional Worker var | Estimated AI spend cap for the UTC month, in dollars. Leave unset. The code default is 10. |
| `MATCH_CANDIDATES` | Optional Worker var | How many jobs the SQL pass sends to the model (50–800). Leave unset. The code default is 500. |
| `TURNSTILE_SECRET_KEY` | Optional Worker secret | Same secret as Vercel `TURNSTILE_SECRET_KEY`. Leave unset until the widget exists. Direct callers then need `turnstile_token`. Trusted Next.js calls skip it. |

Set the Worker secret without writing it into `wrangler.toml`:

```bash
cd workers/resume-match
npx wrangler secret put MATCH_TRUSTED_SECRET
```

## Deploy (when you mean to)

Apply the migration first, then deploy this Worker. The other order makes every match fail, because this source calls `match_candidates`, which does not exist until the migration runs. Applying only the migration leaves the live Worker on `match_index`.

Do not set `MATCH_MONTHLY_CAP_USD`. Unset means the cap stays $10.

```bash
# 1. Migration on the production database (Supabase SQL editor or CLI).
#    File: supabase/migrations/20261114190000_match_candidates.sql
#    The backfill reads every job description once. It does not rewrite jobs.

# 2. Worker. The secret is already on the live Worker; put it again only if it is missing.
cd workers/resume-match
npx wrangler secret put MATCH_TRUSTED_SECRET
npx wrangler deploy
```

No Vercel change is required. Preview and production already call this Worker when `MATCH_TRUSTED_SECRET` and `MATCH_WORKER_URL` are set.

Deploy this Worker before you set `MATCH_TRUSTED_SECRET` on Vercel for a new environment. Until both sides have the secret, the new site refuses to call the Worker.

Then set the same secret and `MATCH_WORKER_URL` on the Vercel project (Preview and Production). Do not prefix either name with `NEXT_PUBLIC_`.

`account_id`, the KV id, the D1 id, and the signup service binding in `wrangler.toml` match the existing Worker. Bindings are unchanged.

## Tests

```bash
node workers/resume-match/worker.test.mjs
```

The test uses a fake D1 and a fake AI binding. It does not call Cloudflare and it does not send email.
