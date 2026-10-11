# Ontario Public Jobs

The live site is the Next.js app in `web/`. Root-level `*.html`, `jobs/`, `employers/`, `index.html`, `sitemap.xml`, and `robots.txt` are legacy GitHub Pages output and are **not** served. `scripts/` and `data/` are still used by the import. Do not edit the legacy HTML to change the live site.

The weekday refresh lives on the owner's ops box. That box cannot reach Postgres; it sends the importer's SQL through an HTTPS connector. After a refresh, tell Google about new and closed URLs with:

```
pip install google-auth
python3 scripts/notify_indexing.py --previous /path/to/previous.json --new /path/to/new.json
```

`GOOGLE_INDEXING_SA_JSON` is the service-account JSON, or `GOOGLE_INDEXING_SA_FILE` is a path to that file. Add `--dry-run` to print the URLs without calling Google.

# Ontario Public Jobs — Combined feed

Static GitHub Pages deploy folder containing combined Crown and agency job listings (Workday, Dayforce, SuccessFactors, and other ATS sources), detail pages, and the live site assets. Job descriptions are preserved from the supplied feed and apply links point to the employer sites.

## Job alert signup

The job board stays in the HTML and is public. The homepage form collects an email address and an unchecked CASL consent box, then asks an optional pay question that does not block signup.

GitHub Pages cannot call Resend from the browser (the API blocks browser CORS, and the API key must not be in the page). `worker/signup.js` is the endpoint that creates the contact on the Resend segment **Ontario Public Jobs subscribers** (`e749c971-4701-4a99-9448-c315ff27a47b`). A repeat signup updates that contact and makes sure it is on the segment. Consent text, source, and time are stored on the contact.

Formspree was not wired (there is no form id in the repo). Its free plan can store a submission, but adding the address to Resend needs the paid submissions API or a paid webhook. The Worker is the free path that lands the contact on the segment.

After the contact is saved, the Worker sends the published Resend template `job-alerts-welcome` from `Public Jobs <alerts@publicjobs.ca>`. A failed welcome send does not undo the signup.

The live signup endpoint is `https://ontario-public-jobs-signup.publicjobs.workers.dev`.

Pushes to `main` that change `worker/` or the deploy workflow publish that Worker. The Cloudflare token's account was discovered without `CLOUDFLARE_ACCOUNT_ID`. Its `workers.dev` subdomain is `publicjobs`.
