import { LEGAL } from "@/lib/legal-config";

function Mail() {
  const email = LEGAL.supportEmail;
  if (email.includes("@") && !email.includes("[")) {
    return <a href={`mailto:${email}`}>{email}</a>;
  }
  return <>{email}</>;
}

export function FraudPolicy() {
  return (
    <section className="description">
      <h2>Fraudulent job postings policy</h2>
      <p>
        Last updated {LEGAL.fraudPolicyUpdated}. Published under section 8.7 of Ontario&apos;s Employment Standards Act,
        2000.
      </p>
      <p>
        PublicJobs.ca collects job postings from employers&apos; own public career websites. We do not accept postings
        from anyone else. Even so, a posting could be fake, could impersonate a real employer, or could link to a site
        that tries to collect money or personal information.
      </p>
      <p>
        <strong>How to report.</strong> Use the &quot;Report a fake or suspicious job&quot; link on any job page, or
        email <Mail /> with the job link and what you noticed. The form is at <a href="/report/">Report a job</a>.
      </p>
      <p>
        <strong>What we do.</strong> We review each report within {LEGAL.fraudReviewBusinessDays} business days. If a
        posting looks fraudulent, we hide it while we check it against the employer&apos;s own careers site. If we
        confirm it is fraudulent, or cannot confirm it is real, we remove it and stop collecting from that source until
        it is fixed. We tell the employer when it appears to be impersonated. We keep a record of each report and what
        we did for {LEGAL.fraudRecordYears} years.
      </p>
      <p>
        <strong>Protect yourself.</strong> Real public-sector employers do not charge you to apply and do not ask for
        banking details or payment before hiring. Apply only on the employer&apos;s official site. If you have lost
        money or shared banking or identity details, contact your bank and report it to your local police and the
        Canadian Anti-Fraud Centre (
        <a href="https://antifraudcentre-centreantifraude.ca/">antifraudcentre-centreantifraude.ca</a>).
      </p>
      <p>We keep copies of this policy for three years after it is replaced.</p>
    </section>
  );
}
