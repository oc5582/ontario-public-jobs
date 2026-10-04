# Resume match Worker (preview)

Live preview: https://publicjobs-resume-match.publicjobs.workers.dev/ (page) and POST /match (API).
Not linked from publicjobs.ca yet.

## What it does
1. Checks origin (publicjobs.ca, www, the workers.dev preview, localhost), email and the CASL consent box.
2. Signs the person up by calling the existing `ontario-public-jobs-signup` Worker through a service binding
   (same Resend segment, CASL properties and welcome email). Addresses ending in `@resend.dev` skip this step (test mode).
3. Enforces caps in D1 (atomic): monthly AI spend cap ($10, `MONTHLY_SPEND_CAP_USD`), 3 lifetime uses per person
   (email lowercased, +tag removed, dots removed for Gmail), 3 lifetime uses per IP, 300 runs per UTC day.
   Only SHA-256 hashes of the normalized email and IP are stored. A failed AI run gives the use back.
4. Builds a compact job index from https://publicjobs.ca/data/listings.json (cached 1 hour). Job URLs mirror
   `scripts/build_pages.py` (`sort_jobs` + `assign_paths`); verified identical to sitemap.xml for all 491 jobs on 2026-10-04.
   If assign_paths changes, update the JS copy.
5. Sends the resume text plus 32-job batches to Workers AI (`@cf/openai/gpt-oss-120b`, all batches in parallel) with a
   high-recall prompt, and returns `strong` and `maybe` groups with a one-line reason each.
6. Records measured cost (`usage.neurons` x $0.011/1000 neurons) into the monthly spend counter.

Resume text is never stored or logged.

## Config (no redeploy needed)
- KV `config_model`: override model (e.g. `@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
- KV `config_batch`: jobs per AI call (10 to 150).

## Requirements before launch
- Workers Paid plan ($5 USD/month). On the free plan Workers AI stops after 10,000 neurons/day (about 3 to 4 matches).
