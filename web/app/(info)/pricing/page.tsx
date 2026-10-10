import { getViewer } from "@/lib/auth";
import { LEGAL } from "@/lib/legal-config";
import { checkoutCheckboxText, refundSentence, sellerLine, taxLine } from "@/lib/legal-copy";
import { membershipPeriodLabel } from "@/lib/membership";
import { pageMetadata } from "@/lib/seo";
import { PLANS, planPriceLine, type PlanId } from "@/lib/site";
import { openPortal, startCheckout } from "../../billing/actions";

export const metadata = pageMetadata({
  title: "Membership | PublicJobs.ca",
  description:
    "PublicJobs.ca membership prices: CA$14.99 a month, CA$29.99 every 3 months (about CA$10 a month), or CA$59 a year (about CA$4.92 a month). Applying stays free.",
  path: "/pricing/",
});

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewer = await getViewer();
  const notice = typeof params.notice === "string" ? params.notice : "";
  const profile = viewer.profile;
  const subscribed = Boolean(
    profile?.stripe_subscription_id &&
      (profile.membership_status === "active" || profile.membership_status === "past_due"),
  );
  const current = PLANS.find((item) => item.id === profile?.plan);
  const checkout = Boolean(viewer.email) && !subscribed;

  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Membership</h1>
        <section className="description">
          <p>
            Every job page is free, and Apply goes to the employer. A membership opens the full filtered list of
            openings and up to 20 resume matches a day. Employers are never charged. PublicJobs.ca is a search tool,
            not a recruiter, and a membership does not get you a job or an interview.
          </p>
          <p>PublicJobs.ca is independent and is not affiliated with any government or employer.</p>
          {subscribed && current && profile ? (
            <p>
              Your plan is {current.name} ({planPriceLine(current.id)}). {membershipPeriodLabel(profile)}
            </p>
          ) : null}
          {notice === "stripe" ? (
            <p className="status err" role="status">
              Billing is not available right now.
            </p>
          ) : null}
          {notice === "plan" ? (
            <p className="status err" role="alert">
              Choose one of the three memberships below.
            </p>
          ) : null}
          {notice === "terms" ? (
            <p className="status err" role="alert">
              Check the box to agree to the Terms before continuing.
            </p>
          ) : null}
          {notice === "name" ? (
            <p className="status err" role="alert">
              Enter the name to put on the agreement.
            </p>
          ) : null}
          <Disclosure />
          {checkout ? (
            <p>
              Check your name and the plan below. You can change them on this page before you continue. To decline,
              leave this page without paying. <a href="/">No thanks</a>
            </p>
          ) : null}
          <ul className="plan-list">
            {PLANS.map((plan) => (
              <li key={plan.id}>
                <span className="plan-name">{plan.name}</span>
                <span className="plan-price">{planPriceLine(plan.id)}</span>
                <PlanAction
                  planId={plan.id}
                  signedIn={Boolean(viewer.email)}
                  subscribed={subscribed}
                  currentPlan={profile?.plan === plan.id}
                  currentAndRenewing={
                    subscribed && profile?.plan === plan.id && profile.membership_status === "active" && !profile.cancel_at
                  }
                />
              </li>
            ))}
          </ul>
          <h2>Cancel and refunds</h2>
          <p>
            There is no free trial that turns into a charge, and there are no countdown timers. You create an account
            before you pay. You can cancel yourself from the account page. After you cancel, access continues until the
            end of the period you already paid for. {refundSentence()}
          </p>
          <p>{taxLine()}</p>
          <p>
            The weekly email stays free. An active membership includes 20 resume matches a day. A free account includes
            one match. Matching is never required to get the weekly email, and the weekly email is never required to
            match.
          </p>
        </section>
      </article>
    </main>
  );
}

function Disclosure() {
  return (
    <div className="legal-box">
      <h2>Before you subscribe</h2>
      <p>
        Seller: {sellerLine()} · {LEGAL.mailingAddress} · {LEGAL.phone} · {LEGAL.supportEmail}
      </p>
      <p>
        What you get: the full filterable list of current openings and up to 20 resume matches a day, starting right
        away. Job pages, Apply links and the weekly email stay free. A membership does not get you a job or an
        interview. PublicJobs.ca is not a recruiter and is not affiliated with any government or employer.
      </p>
      <p>Prices, in Canadian dollars. No other fees.</p>
      <ul>
        {PLANS.map((plan) => (
          <li key={plan.id}>
            {plan.name}: {planPriceLine(plan.id)}
          </li>
        ))}
      </ul>
      <p>{taxLine()}</p>
      <p>
        Each plan renews automatically at the same price, plus tax, until you cancel. We email a reminder at least{" "}
        {LEGAL.yearlyReminderDays} days before a yearly renewal and at least {LEGAL.quarterReminderDays} days before a
        3-month renewal.
      </p>
      <p>
        Cancel anytime on your Account page, by email or by phone. Access lasts until the end of the paid period.
      </p>
      <p>
        Refund: full refund if you ask within 14 days of your first purchase or of a renewal, once per account in any
        12 months.
      </p>
      <p>Memberships are offered to people in {LEGAL.sellTo}.</p>
      <p>
        Terms version {LEGAL.termsVersion}. The full terms are on the <a href="/terms/">terms page</a>.
      </p>
    </div>
  );
}

function PlanAction({
  planId,
  signedIn,
  subscribed,
  currentPlan,
  currentAndRenewing,
}: {
  planId: PlanId;
  signedIn: boolean;
  subscribed: boolean;
  currentPlan: boolean;
  currentAndRenewing: boolean;
}) {
  if (!signedIn) {
    return (
      <a className="apply-btn" href="/login/?next=/pricing/">
        Sign in to continue
      </a>
    );
  }
  if (currentAndRenewing) return <span className="plan-current">Current plan</span>;
  if (subscribed) {
    return (
      <form action={openPortal}>
        <button className="apply-btn secondary" type="submit">
          {currentPlan ? "Manage billing" : "Change plan"}
        </button>
      </form>
    );
  }
  return (
    <form action={startCheckout}>
      <input type="hidden" name="plan" value={planId} />
      <label className="checkout-name">
        Your name
        <input name="customer_name" type="text" required autoComplete="name" maxLength={120} />
      </label>
      <label className="checkbox terms-ack">
        <input type="checkbox" name="agree" value={planId} required />
        <span>{checkoutCheckboxText(planId)}</span>
      </label>
      <button className="apply-btn" type="submit">
        Continue to secure payment
      </button>
    </form>
  );
}
