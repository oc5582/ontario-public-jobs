# Ontario Public Jobs

Static GitHub Pages site for Toronto Crown corporation and public-agency openings. Current listings are Workday-source Crown and agency Toronto jobs. Job descriptions are rendered as crawlable HTML (not fetched in the browser).

Live: https://oc5582.github.io/ontario-public-jobs/

## Serve locally

```bash
python3 -m http.server 8787
```

Then open http://localhost:8787/

## Rebuild pages

After updating `data/listings.json`:

```bash
python3 scripts/build_pages.py
```

This writes `index.html`, `jobs/<slug>.html`, `sitemap.xml`, and `robots.txt`.

## Files

- `index.html` — home list + signup form
- `jobs/` — one static page per opening
- `styles.css` — minimal layout
- `copy.js` / `app.js` — signup form only (listings are already in HTML)
- `data/listings.json` — enriched listing source
- `sitemap.xml` — home + every job URL

## Signup endpoint (optional)

Set before load:

```html
<script>window.__SIGNUP_ENDPOINT__ = "https://example.com/signup";</script>
```

POST body (JSON only): `{ "email", "region", "employer_type", "keyword" }`.
CASL consent and soft-pay answers are not included in the POST body.
