import { sellerLine } from "@/lib/legal-copy";
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
      <p>Last updated: October 15, 2026</p>
      <p>
        PublicJobs.ca is an independent job board. It is not affiliated with any government or with any employer listed
        on the site. This page explains what personal information we collect, why, and how you can control it.
      </p>
      <h2>Who is responsible</h2>
      <p>
        PublicJobs.ca is operated by {sellerLine()}, {LEGAL.mailingAddress}. Our privacy officer is{" "}
        {LEGAL.privacyOfficerName}, reachable at <Mail email={LEGAL.privacyOfficerEmail} /> or{" "}
        <a href={LEGAL.phoneTel}>{LEGAL.phone}</a>. We answer access and correction requests within 30 days.
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
        To create an account, you sign in with a one-time link sent to your email address by Supabase Auth, or with
        Google if you choose Continue with Google. There is no password. Supabase Auth stores your email address, the
        date the account was created, and the time of your latest sign-in. It does not keep a list of every earlier
        sign-in.
      </p>
      <p>
        Our database stores a profile for that account: your email address, when the profile was created, your
        membership status, your plan if you have one, the Stripe customer id and subscription id, when the current paid
        period ends, and when a cancellation takes effect. After you pay, we also store the name collected at checkout.
        We do not store a resume on the account.
      </p>
      <p>
        If you have a membership, you can mark a job as applied. We store your account id, the job id while that
        posting is still on the site, the job page address, the time you marked it, and a copy of the job&apos;s
        title, employer, location, pay, closing date, and employer link as they were that day. The copy keeps the job
        on your &quot;Jobs I applied to&quot; list after the posting leaves the board. We do not store what you sent
        the employer. Only you can see that list. Choosing &quot;Applied ✓ (undo)&quot; on the job page, or
        &quot;Remove&quot; on the list, deletes that row and its copy. We keep the mark until you undo it or delete
        your account, or until 30 days after your membership ends. Deleting the account deletes these rows, because
        they are tied to the sign-in account. When your membership ends, the list is hidden. If you become a member
        again within 30 days, it shows again. After 30 days without a membership, we delete it.
      </p>
      <p>
        Memberships are offered in Canada only. Prices are in Canadian dollars and are shown plus GST/HST. You can ask
        for a full refund within {LEGAL.refundWindowDays} days of your first purchase and of each renewal, once per
        account in any 12 months. The <a href="/terms/">terms page</a> has the full refund rules.
      </p>
      <h2>Payments</h2>
      <p>
        Stripe processes the payment. On our pricing page you choose a plan and your Canadian billing province. We send
        that province to Stripe as a tax rate, and Stripe adds that GST or HST on top of the price. Quebec is charged
        GST only, because we are not registered for Quebec sales tax. We do not use Stripe&apos;s automatic tax
        product. Stripe&apos;s payment page then collects your name, billing address, and card details. The tax added
        is the rate for the province you chose on our page.
      </p>
      <p>
        We never see your full card number. After a successful payment we store your name, the plan, the membership
        status, the Stripe customer id, the Stripe subscription id, the end of the paid period, the amount charged and
        the tax amount, the last 4 digits of the card, the terms version and the time you agreed, and the billing
        province you chose. The street address and postal code stay with Stripe. We also store each Stripe notice id so
        the same notice is not applied twice.
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
        signing up for alerts. The alert checkbox on the match page is optional. If you leave it unchecked, matching
        does not add you to the weekly email.
      </p>
      <h2>Resume matching</h2>
      <p>
        If you use resume matching, we use your resume only to find matching jobs. If you are not signed in, we ask for
        your email address so the free match is counted once per person.
      </p>
      <p>
        One match is free per person, with or without an account. That match shows the top 10 jobs. A membership gets up
        to 20 matches a day. A match that fails is not counted. To count the free match, we keep the email address, whether
        you checked the job alert box, and when the match ran, for 90 days after the match. After that the record is
        deleted. We also set a cookie on your browser that marks the free match as used, and we keep a daily count per
        network, stored as a scrambled code rather than your IP address and deleted after 7 days.
      </p>
      <p>
        You can upload a PDF or Word file, or paste the text. The file stays on your device. The page reads the text in
        your browser and does not upload the file. For a PDF, it reads the first 10 pages. We send that text to our
        matching service. We cut the text off at 15,000 characters. If you check the job alert box, we also send your
        email address to the signup service and we store the consent record described above. Matching itself does not
        sign you up.
      </p>
      <p>
        Only the text (up to 15,000 characters) is sent to our servers and then to Cloudflare Workers AI, which may
        process it outside Canada, to find matching jobs. We do not keep the file or the text. The text stays in memory
        while the match runs, then we discard it. We do not save it to our database, and we do not write it to our
        match logs. If matching fails, the log is a short error message, not your resume. Remove anything you do not
        want to share, such as your home address or immigration details, before matching.
      </p>
      <p>
        We send the matches back to your browser. We do not store the matches or the list of jobs we showed you. To
        count matches, we store a row on your account with the date of each match that finished, plus a scrambled form
        of your email used only for that count.
      </p>
      <p>
        The matching service also keeps site-wide counters: how many matches ran that day, and an estimate of that
        month&apos;s matching cost. Those are counts for the whole site, not a copy of your resume, and not a limit on
        your household or your network.
      </p>
      <p>We do not sell resumes or share them with employers.</p>
      <h2>Service providers</h2>
      <p>
        We use these providers to run the site. Each processes personal information for us under its own terms and only
        for the services it provides to us:
      </p>
      <ul>
        <li>
          <strong>Vercel</strong> (website hosting; the live site&apos;s functions run in Montreal) – handles every page
          request, including resume text you send for matching, and keeps server logs such as IP address and browser.
          Vercel Web Analytics is described under Site analytics.
        </li>
        <li>
          <strong>Supabase</strong> (database and sign-in; data stored in Canada, Montreal region) – accounts,
          memberships, agreement and alert-consent records, match counts, and the jobs a member has marked as applied.
        </li>
        <li>
          <strong>Stripe</strong> (payments; may process data in the United States and elsewhere) – your name, billing
          address, and card, and the tax rate we attach for the province you chose on our pricing page.
        </li>
        <li>
          <strong>Cloudflare</strong> (DNS, cookieless Web Analytics, the email-signup Worker, and resume matching
          through Workers AI; may process data outside Canada).
        </li>
        <li>
          <strong>Resend</strong> (sending email; United States) – weekly job alerts, the membership agreement email,
          and renewal reminders. For alerts it holds your email address, consent record, and unsubscribe status.
        </li>
        <li>
          <strong>Google</strong> (sign-in, if you choose Continue with Google) – the account you use to sign in, under
          Google&apos;s own terms.
        </li>
        <li>
          <strong>Meta</strong> (advertising measurement, only after you choose Allow) – see Ads and the Meta Pixel.
          Pixel id 4654096711502773.
        </li>
        <li>
          <strong>jsDelivr</strong> (script delivery) – your browser loads the PDF and Word readers from jsDelivr. The
          resume file is not sent to jsDelivr.
        </li>
      </ul>
      <p>
        When information is processed outside Canada, it is subject to the laws of that country and may be accessed by
        its courts, law enforcement and national security authorities.
      </p>
      <h2>Ads and the Meta Pixel</h2>
      <p>
        The Meta Pixel stays off until you choose Allow on the notice. After that, it tells Meta which pages you view
        and whether you signed up for alerts, created an account, finished a resume match, viewed membership prices,
        started checkout, paid, or clicked through to an employer&apos;s site, so we can measure and improve our
        Facebook and Instagram ads. Meta may use cookies and may link this to your Meta account under Meta&apos;s own
        policies (<a href="https://facebook.com/privacy/policy">facebook.com/privacy/policy</a>). We do not send Meta
        your name, email address, postal address, or resume. To turn it off, use Turn off ad tracking in the footer.
        That choice is saved in your browser.
      </p>
      <h2>Site analytics and fonts</h2>
      <p>
        We use Cloudflare Web Analytics to count visits. It uses no cookies and does not track you across sites. It
        records things like the page you visited, the referring site, your browser, and your country. It stays on
        because it does not use cookies.
      </p>
      <p>
        We use Vercel Web Analytics. It does not set a cookie. It records page views and these events: signup (first
        sign-in, and whether it was email or Google), paywall_view (which page showed the membership card),
        pricing_view, checkout_start (which plan), purchase (which plan), match_email (an email was entered for a free
        match, and whether the alert box was checked), match_run (no account, free account or membership), and
        mark_applied (whether a member marked a job applied or undid it). Those events do not include your name, email
        address, resume, card, or which job you marked.
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
            <td>While you are subscribed. Unsubscribing stops the emails. The site does not delete that record on a timer.</td>
          </tr>
          <tr>
            <td>Account</td>
            <td>Until you delete it.</td>
          </tr>
          <tr>
            <td>Membership and payment records (no full card numbers)</td>
            <td>6 years after the transaction, for Canadian tax records.</td>
          </tr>
          <tr>
            <td>Agreement records (terms version, time agreed, province, last 4 digits)</td>
            <td>6 years after the transaction, with the payment records.</td>
          </tr>
          <tr>
            <td>Resume match counts</td>
            <td>Until you delete the account.</td>
          </tr>
          <tr>
            <td>Free match record when you are not signed in (email address, alert choice, date)</td>
            <td>90 days after the free match, then deleted automatically.</td>
          </tr>
          <tr>
            <td>Jobs you marked as applied, with the copy of each job&apos;s details</td>
            <td>Until you undo the mark or delete the account. Deleted 30 days after your membership ends; hidden until then.</td>
          </tr>
          <tr>
            <td>Site-wide match counters</td>
            <td>Kept as running counts. The software does not delete them on a schedule.</td>
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
        You can delete your account on the Account page. If a membership is still renewing, we cancel the Stripe
        subscription first. If we cannot, we stop and ask you to cancel it from Manage billing. We then delete the
        profile, the sign-in account, the match counts, and the jobs you marked as applied. We keep the billing and agreement records described above,
        including the email and name on those records. Stripe also keeps its own customer and payment record. Alert
        signup records are not removed by deleting the account. You can unsubscribe from alerts using the link in any
        email. You can turn off ad tracking at any time with the &quot;Turn off ad tracking&quot; button in the site
        footer.
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
