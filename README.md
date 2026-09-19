# Ontario Public Jobs — week-1 landing preview

Static single-page preview. No build step.

## Serve locally

```bash
cd /workspace/ontario-public-jobs
python3 -m http.server 8787
```

Then open http://localhost:8787/

## Files

- `index.html` — page shell
- `styles.css` — minimal layout
- `copy.js` — all UI strings
- `app.js` — form + listings
- `data/listings.json` — copied from `/workspace/listings/listings.json`

## Signup endpoint (optional)

Set before load:

```html
<script>window.__SIGNUP_ENDPOINT__ = "https://example.com/signup";</script>
```

POST body (JSON only): `{ "email", "region", "employer_type", "keyword" }`.  
CASL consent and soft-pay answers are not included in the POST body.
