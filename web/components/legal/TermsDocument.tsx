import { LEGAL } from "@/lib/legal-config";
import { refundSentence, taxLine } from "@/lib/legal-copy";

function Mail() {
  const email = LEGAL.supportEmail;
  if (email.includes("@") && !email.includes("[")) {
    return <a href={`mailto:${email}`}>{email}</a>;
  }
  return <>{email}</>;
}

export function TermsDocument() {
  return (
    <section className="description">
      <p>Last updated {LEGAL.effectiveDate}</p>
      <h2>Listings</h2>
      <p>
        Listings are collected from employers&apos; public career sites. They may be out of date, closed, or changed.
        Always confirm the details on the employer&apos;s site. We do not guarantee that the listings are accurate or
        complete. A membership does not guarantee any number of listings or employers.
      </p>
      <h2>Applying</h2>
      <p>
        Applying is free. We do not take applications. Applying happens on the employer&apos;s site. A membership for
        the full filtered list and extra resume matching is optional.
      </p>
      <h2>What PublicJobs is not</h2>
      <p>
        PublicJobs.ca is a search tool. It is not an employment agency, recruiter or temporary help agency. We do not
        find jobs for you, contact employers for you, send your resume or details to employers, take applications,
        arrange interviews, or get paid by employers. Every job page and Apply link is free. A membership pays for
        convenience features only: the full filterable list and resume keyword matching that you run yourself, up
        to 20 matches a day. We cannot promise you a job or an interview. PublicJobs.ca is independent. It
        is not affiliated with or endorsed by any government or any employer listed on the site.
      </p>
      <h2 id="membership">Membership terms</h2>
      <p>
        Last updated {LEGAL.effectiveDate}. Version {LEGAL.termsVersion}.
      </p>
      <p>
        <strong>1. Who you are dealing with.</strong> PublicJobs.ca is operated by {LEGAL.legalName}, a sole proprietor
        operating as {LEGAL.businessName}, {LEGAL.mailingAddress}, Ontario, Canada. Phone {LEGAL.phone}. Email <Mail />.
        GST/HST {LEGAL.hstNumber}.
      </p>
      <p>
        <strong>2. What a membership is.</strong> A membership gives you, while it is active: (a) the full list of
        current openings on PublicJobs.ca with all filters, and (b) up to 20 resume matches a day. Matching compares
        your resume with current openings using automated tools, including AI, and shows openings that look like a fit
        with a short reason. Matches are suggestions and can be wrong. Job pages, Apply links and the weekly email stay
        free without a membership. A membership does not get you a job or an interview. PublicJobs.ca is a search tool.
        It is not an employment agency or recruiter, does not contact employers for you, and does not send your
        information to employers. PublicJobs.ca is independent and is not affiliated with or endorsed by any government
        or employer. You need an email address and a current web browser. Memberships are offered to people in{" "}
        {LEGAL.sellTo}.
      </p>
      <p>
        <strong>3. Prices.</strong> Monthly: CA$14.99 every month. 3 months: CA$29.99 every 3 months. Yearly: CA$59.00
        every year. Prices are in Canadian dollars. {taxLine()} There are no other fees.
      </p>
      <p>
        <strong>4. Payment and automatic renewal.</strong> You pay by card through our payment processor, Stripe. We do
        not see or store your full card number. Your first payment is charged when you subscribe and your membership
        starts right away. Your membership renews automatically at the end of each period (every month, every 3 months,
        or every year, depending on your plan), and we charge the same card the price for your plan plus tax, until you
        cancel. We will email you a reminder before each renewal: at least {LEGAL.yearlyReminderDays} days before a
        yearly renewal and at least {LEGAL.quarterReminderDays} days before a 3-month renewal.
      </p>
      <p>
        <strong>5. Cancelling.</strong> You can cancel at any time on your Account page (Manage billing). You can also
        cancel by emailing <Mail /> or calling {LEGAL.phone}. When you cancel, renewal stops. You keep access until the
        end of the period you have already paid for, and you are not charged again.
      </p>
      <p>
        <strong>6. Refunds.</strong> {refundSentence()} If we end your membership for a reason that is not your fault,
        or we shut down the service, we refund the unused part of your current period. These refund rights are in
        addition to your rights under consumer protection law, including the Ontario Consumer Protection Act, 2002,
        which we cannot and do not limit.
      </p>
      <p>
        <strong>7. Fair use.</strong> A membership is for one person&apos;s own job search. Do not share your login,
        resell or republish the member list, or copy it with automated tools. We may limit unusual use (for example,
        very high numbers of requests) to keep the site working for everyone.
      </p>
      <p>
        <strong>8. Suspension.</strong> We may suspend or end a membership that breaks section 7, after telling you why
        where it is reasonable to do so. If we end it for a breach, we may refund the unused part of your period at our
        discretion, unless the law requires otherwise.
      </p>
      <p>
        <strong>9. Changes to price or terms.</strong> We may propose changes to the price of your plan or to these
        membership terms, no more often than once every 12 months for price. We will email you at least{" "}
        {LEGAL.priceChangeMinDays} days and no more than {LEGAL.priceChangeMaxDays} days before the change takes
        effect. The email will show the new terms and price and the date they start, and explain how to cancel at no
        cost. If you do not want the change, you can cancel before it takes effect and you will not be charged the new
        price. If you do nothing, the change applies from your next renewal on or after the effective date. Changes do
        not affect amounts you have already paid.
      </p>
      <p>
        <strong>10. Our responsibility.</strong> We work to keep listings current, but employers change and remove
        postings, and we cannot guarantee that every listing is accurate, complete or still open, or that the site will
        always be available. To the extent the law allows, we are not responsible for indirect losses, such as lost job
        opportunities. Nothing in these terms limits any right you have under consumer protection law that cannot be
        limited by contract.
      </p>
      <p>
        <strong>11. Copy of your agreement.</strong> After you subscribe, we email you a copy of these terms, your plan,
        price, tax and the date you subscribed. Keep it for your records. You can print or save this page at any time.
      </p>
      <p>
        <strong>12. Law.</strong> These terms are governed by the laws of Ontario and the federal laws of Canada that
        apply there. This does not take away any rights you have under the consumer protection law of the province
        where you live.
      </p>
      <p>
        <strong>13. Age.</strong> You must be at least {LEGAL.minimumAge} to buy a membership.
      </p>
      <h2>Accounts</h2>
      <p>
        Keep your login email secure. We may end a magic-link session. You can delete your account on the Account page.
        We keep billing and agreement records the law requires, and we say so there.
      </p>
      <h2>Fraudulent job postings</h2>
      <p>
        How to report a posting, and what we do with a report, is in the{" "}
        <a href="/fraud-policy/">fraudulent job postings policy</a>.
      </p>
      <h2>External links</h2>
      <p>Links to other websites are not ours. We are not responsible for those sites.</p>
      <h2>Email alerts</h2>
      <p>
        Email alerts are optional. We send them only with your consent. The consent request names PublicJobs.ca, the
        mailing address, and how to withdraw consent. Every email has an unsubscribe link. Matching is never conditional
        on signing up for alerts. See our <a href="/privacy/">privacy policy</a>.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not scrape the site in a way that overloads it. Do not misuse the signup form, for example by signing up
        other people. Member pages are covered by section 7 above.
      </p>
      <p>
        Questions: <Mail /> or {LEGAL.phone}.
      </p>
    </section>
  );
}
