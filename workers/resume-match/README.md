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
- The site-wide daily cap (300 per UTC day) and the monthly AI spend cap ($10) still apply.
- Consent is optional. The address is subscribed only when `casl_consent` is yes.

The response shape is unchanged: `{ ok, error, strong, maybe, jobs_checked, remaining }`. `remaining` is null for trusted callers. `partial` is false on success. A partial AI failure is an error, not a partial result.

## Env

| Name | Where | Notes |
| --- | --- | --- |
| `MATCH_TRUSTED_SECRET` | Worker secret and Vercel server env | Same long random string on both sides. Not a `NEXT_PUBLIC_` variable. Never commit the value. |
| `MATCH_WORKER_URL` | Vercel server env only | `https://publicjobs-resume-match.publicjobs.workers.dev/match` |
| `MATCH_DAILY_CAP` | Optional Worker var | Overrides the 300/day cap. Leave unset in production. |

Set the Worker secret without writing it into `wrangler.toml`:

```bash
cd workers/resume-match
npx wrangler secret put MATCH_TRUSTED_SECRET
```

## Deploy (when you mean to)

Deploy this Worker before you set `MATCH_TRUSTED_SECRET` on Vercel. Until both sides have the secret, the new site refuses to call the Worker, and the live site keeps using whatever is already published.

```bash
cd workers/resume-match
npx wrangler secret put MATCH_TRUSTED_SECRET
npx wrangler deploy
```

Then set the same secret and `MATCH_WORKER_URL` on the Vercel project (Preview and Production). Do not prefix either name with `NEXT_PUBLIC_`.

`account_id`, the KV id, the D1 id, and the signup service binding in `wrangler.toml` match the existing Worker. Bindings are unchanged.

## Tests

```bash
node workers/resume-match/worker.test.mjs
```

The test uses a fake D1 and a fake AI binding. It does not call Cloudflare and it does not send email.
