import { LEGAL } from "@/lib/legal-config";

function Mail({ email }: { email: string }) {
  if (email.includes("@") && !email.includes("[")) {
    return <a href={`mailto:${email}`}>{email}</a>;
  }
  return <>{email}</>;
}

export function PrivacyDocument() {
  return (
    <section className="description">
      <p>Last updated: {LEGAL.effectiveDate}</p>
      <p>
        PublicJobs.ca is an independent job board. It is not affiliated with any government or with any employer listed
        on the site. This page explains what personal information we collect, why, and how you can control it.
      </p>
      <h2>Who is responsible</h2>
      <p>
        PublicJobs.ca is operated by {LEGAL.legalName} ({LEGAL.businessName}), {LEGAL.mailingAddress}. Our privacy
        officer is {LEGAL.privacyOfficerName}, reachable at <Mail email={LEGAL.privacyOfficerEmail} /> or {LEGAL.phone}.
        We answer access and correction requests within 30 days.
      </p>
      <h2>Browsing the site</h2>
      <p>
        You can read every job page and apply without an account. Lists show the newest 10 openings unless you have a
        membership. When you click &quot;Apply on employer site&quot;, you leave PublicJobs.ca and go to the
        employer&apos;s own website. That employer&apos;s privacy policy applies there. We do not receive your
        application.
      </p>
      <h2>Accounts and membership</h2>
      <p>
        To create an account, you sign in with a one-time link sent to your email address, or with Google. We store
        your email address, the dates you signed in, and, if you buy a membership, your membership status, plan,
        renewal date, your name as given at checkout, your billing province or postal code (to charge the right tax),
        the date and version of the terms you agreed to, and the Stripe customer ID. Stripe, our payment processor,
        collects and stores your card details; we never see your full card number.
      </p>
      <h2>Email alerts</h2>
      <p>If you sign up for email alerts, we collect:</p>
      <ul>
        <li>your email address</li>
        <li>a record that you ticked the consent box, including the consent wording you agreed to</li>
        <li>the web page address where you signed up</li>
      </ul>
      <p>
        We use this only to send you job alert emails from PublicJobs.ca and to understand interest in the service. We
        do not sell or rent your information, and we do not share it with employers. Matching is never conditional on
        signing up for alerts.
      </p>
      <h2>Resume matching</h2>
      <p>If you use resume matching, we use your resume only to find matching jobs.</p>
      <p>
        You can upload a PDF or Word file, or paste the text. The file stays on your device. The page reads the text in
        your browser and does not upload the file. For a PDF, it reads the first 10 pages. You need to be signed in. We
        send that text to our matching service. We cut the text off at 15,000 characters. If you check the job alert
        box, we also send your email address to the signup service. Matching itself does not sign you up.
      </p>
      <p>
        Your resume is read in your browser. Only the text (up to 15,000 characters) is sent to our servers and to
        Cloudflare Workers AI, which may process it outside Canada, to find matching jobs. We do not keep the file or
        the text. Remove anything you do not want to share, such as your home address or immigration details, before
        matching.
      </p>
      <p>
        We use the text only to compare your experience with the current openings. We do not keep the file or the text.
        The text stays in memory while the match runs, then we discard it. We do not save it to our database, and we do
        not write it to our logs. If matching fails, the log is a short error message, not your resume.
      </p>
      <p>
        Cloudflare processes the text to produce your matches. Under Cloudflare&apos;s published Workers AI terms, it
        does not share it with other Cloudflare customers or use it to train AI models. We do not save the text to our
        database or logs after the match. Cloudflare runs Workers and Workers AI on its global network, so this
        processing may happen outside Canada. We send the matches back to your browser. We do not store the matches.
      </p>
      <p>We do not sell resumes or share them with employers.</p>
      <p>
        To count matches, we store a row on your account with the date of each match that finished. A free account gets
        1 match, and that match shows the top 5 jobs. A membership gets up to 20 matches a day. We do not store your
        resume or the list of jobs we showed you. A match that fails is not counted.
      </p>
      <p>
        The matching service also keeps scrambled email and IP counters for a site-wide daily cap and a monthly
        spending cap. Those are counts for the whole site, not a limit on your household or your network.
      </p>
      <h2>Service providers</h2>
      <p>
        We use these providers to run the site. Each processes personal information for us under its own terms and only
        for the services it provides to us:
      </p>
      <ul>
        <li>
          <strong>Vercel</strong> (website hosting; servers in the United States) – handles every page request,
          including resume text you send for matching, and keeps server logs such as IP address and browser.
        </li>
        <li>
          <strong>Supabase</strong> (database and sign-in; data stored in Canada, Montreal region) – accounts,
          memberships and match counts.
        </li>
        <li>
          <strong>Stripe</strong> (payments; may process data in the United States and elsewhere) – card, billing name
          and address, tax calculation.
        </li>
        <li>
          <strong>Cloudflare</strong> (security, cookieless analytics, email signup and resume matching through Workers
          AI; may process data outside Canada).
        </li>
        <li>
          <strong>Resend</strong> (sending email; United States) – your email address, consent record and unsubscribe
          status.
        </li>
        <li>
          <strong>Google</strong> (sign-in, if you choose Continue with Google) – the account you use to sign in, under
          Google&apos;s own terms.
        </li>
        <li>
          <strong>Meta</strong> (advertising measurement, only if you have not turned off ad tracking) – see Ads and the
          Meta Pixel.
        </li>
      </ul>
      <p>
        When information is processed outside Canada, it is subject to the laws of that country and may be accessed by
        its courts, law enforcement and national security authorities.
      </p>
      <h2>Ads and the Meta Pixel</h2>
      <p>
        The Meta Pixel stays off until you choose Allow on the notice. After that, it tells Meta which pages you view
        and whether you signed up for alerts or clicked through to an employer&apos;s site, so we can measure and
        improve our Facebook and Instagram ads. Meta may use cookies and may link this to your Meta account under
        Meta&apos;s own policies (<a href="https://facebook.com/privacy/policy">facebook.com/privacy/policy</a>). We do
        not send Meta your email address or resume, and we do not load the Pixel on the resume matching, account,
        billing, checkout or sign-in pages. To turn it off, use Turn off ad tracking in the footer. That choice is
        saved in your browser.
      </p>
      <h2>Site analytics and fonts</h2>
      <p>
        We use Cloudflare Web Analytics to count visits. It uses no cookies and does not track you across sites. It
        records things like the page you visited, the referring site, your browser, and your country. It stays on
        because it does not use cookies.
      </p>
      <p>Our fonts are hosted on PublicJobs.ca itself, so loading them does not send your information to a font service.</p>
      <h2>How long we keep it</h2>
      <table>
        <thead>
          <tr>
            <th>Information</th>
            <th>How long we keep it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Alert email and consent record</td>
            <td>
              Until you unsubscribe, then the consent and unsubscribe record for 3 years to show we followed anti-spam
              law; the email itself is deleted or suppressed.
            </td>
          </tr>
          <tr>
            <td>Account</td>
            <td>Until you delete it, or 24 months after your last sign-in with no active membership.</td>
          </tr>
          <tr>
            <td>Membership and payment records (no card numbers)</td>
            <td>7 years after the transaction, for tax records.</td>
          </tr>
          <tr>
            <td>Agreement records (terms version, time agreed)</td>
            <td>7 years after the membership ends.</td>
          </tr>
          <tr>
            <td>Resume match counts</td>
            <td>13 months.</td>
          </tr>
          <tr>
            <td>Anti-abuse counters (scrambled email and IP)</td>
            <td>13 months.</td>
          </tr>
          <tr>
            <td>Resume text</td>
            <td>Not kept; discarded after the match.</td>
          </tr>
          <tr>
            <td>Fraud reports</td>
            <td>3 years.</td>
          </tr>
        </tbody>
      </table>
      <h2>Your choices</h2>
      <p>
        You can delete your account on the Account page. We cancel a Stripe subscription first, or we stop and ask you
        to cancel it if we cannot. We then delete the profile and match counts. We keep billing and agreement records
        the law requires, including tax records, and we say so on that page. You can unsubscribe from alerts using the
        link in any email. You can turn off ad tracking at any time with the Ad tracking link in the site footer.
      </p>
      <h2>Unsubscribing</h2>
      <p>
        Every alert email includes a one-click unsubscribe link. You can also email{" "}
        <Mail email={LEGAL.supportEmail} /> and we will remove you.
      </p>
      <h2>Breaches</h2>
      <p>
        If a security breach involving your personal information creates a real risk of significant harm to you, we
        will tell you and the Office of the Privacy Commissioner of Canada as soon as feasible, as required by law. We
        keep a record of every breach for 24 months.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to see the personal information we hold about you, ask us to correct it, or withdraw your consent
        at any time by emailing <Mail email={LEGAL.privacyOfficerEmail} />. We answer within 30 days. If you are not
        satisfied with our response, you can contact the Office of the Privacy Commissioner of Canada at{" "}
        <a href="https://priv.gc.ca">priv.gc.ca</a>.
      </p>
      <h2>Changes to this policy</h2>
      <p>If we change this policy, we will update the date at the top of this page.</p>
    </section>
  );
}
