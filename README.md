# Ontario Public Jobs — Combined feed

Static GitHub Pages deploy folder containing combined Crown and agency job listings (Workday, Dayforce, SuccessFactors, and other ATS sources), detail pages, and the live site assets. Job descriptions are preserved from the supplied feed and apply links point to the employer sites.

## Job alert signup

The job board stays in the HTML and is public. The homepage form collects an email address and an unchecked CASL consent box, then asks an optional pay question that does not block signup.

GitHub Pages cannot call Resend from the browser (the API blocks browser CORS, and the API key must not be in the page). `worker/signup.js` is the endpoint that creates the contact on the Resend segment **Ontario Public Jobs subscribers** (`e749c971-4701-4a99-9448-c315ff27a47b`). A repeat signup updates that contact and makes sure it is on the segment. Consent text, source, and time are stored on the contact.

Formspree was not wired (there is no form id in the repo). Its free plan can store a submission, but adding the address to Resend needs the paid submissions API or a paid webhook. The Worker is the free path that lands the contact on the segment.

There is no custom sending domain yet, so this step only saves the contact. `onboarding@resend.dev` can deliver only to the Resend account address, so job-alert broadcasts wait until a domain is verified.

### What Osama needs to do once

1. Create a free [Cloudflare](https://dash.cloudflare.com/sign-up) account.
2. Create an API token with **Account / Workers Scripts / Edit**.
3. In the Resend dashboard, create an API key that can manage contacts (a send-only key cannot create contacts).
4. In GitHub → Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN`
   - `RESEND_API_KEY`
   - If the token can see more than one Cloudflare account, also add `CLOUDFLARE_ACCOUNT_ID` and set `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}` on the deploy step.
5. Run the **Deploy signup worker** workflow (Actions → Deploy signup worker → Run workflow).
6. Copy the `https://ontario-public-jobs-signup.<account>.workers.dev` URL from the workflow log into `signup.config.js`:

   ```javascript
   window.SIGNUP_ENDPOINT = "https://ontario-public-jobs-signup.<account>.workers.dev";
   ```

7. Commit and push that one-line change to `main`.
8. On the live site, submit a real address with the consent box checked. In Resend → Segments → Ontario Public Jobs subscribers, confirm the contact and the `casl_consent` property.

Until step 7, the form stays visible and the listings stay public, but submit tells the visitor that email alerts are not turned on yet. It does not pretend the signup succeeded.

To try the form on your machine without Cloudflare, run `node worker/dev-server.mjs` and temporarily point `SIGNUP_ENDPOINT` at `http://127.0.0.1:8787`. That local server does not call Resend.
