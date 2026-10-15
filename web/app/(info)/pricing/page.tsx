import { PricingView } from "@/components/AnalyticsEvents";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getViewer } from "@/lib/auth";
import { CA_TAX_JURISDICTIONS } from "@/lib/ca-tax";
import { LEGAL } from "@/lib/legal-config";
import { refundSentence, sellerLine, taxLine } from "@/lib/legal-copy";
import { membershipPeriodLabel } from "@/lib/membership";
import { pageMetadata } from "@/lib/seo";
import { PLANS, planPriceLine } from "@/lib/site";
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
      <PricingView />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Membership</h1>
        <section className="description">
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
          {notice === "province" ? (
            <p className="status err" role="alert">
              Choose your Canadian billing province so GST/HST can be added.
            </p>
          ) : null}
          {checkout ? (
            <CheckoutForm
              action={startCheckout}
              provinces={CA_TAX_JURISDICTIONS.map((item) => ({
                code: item.code,
                label: `${item.name} (${item.displayName} ${item.percentage}%${item.code === "QC" ? ", GST only" : ""})`,
              }))}
            />
          ) : (
            <ul className="plan-list">
              {PLANS.map((plan) => (
                <li key={plan.id}>
                  <span className="plan-name">{plan.name}</span>
                  <span className="plan-price">{planPriceLine(plan.id)}, plus applicable GST/HST</span>
                  <PlanAction
                    signedIn={Boolean(viewer.email)}
                    currentPlan={profile?.plan === plan.id}
                    currentAndRenewing={
                      subscribed && profile?.plan === plan.id && profile.membership_status === "active" && !profile.cancel_at
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {!viewer.email ? <p className="pricing-fine-print">Sign in to continue.</p> : null}
          <p>
            What you get: the full filterable list of current openings and up to 20 resume matches a day, starting right
            away. Job pages, Apply links and the weekly email stay free, and Apply goes to the employer. Employers are
            never charged. A membership does not get you a job or an interview. PublicJobs.ca is a search tool, not a
            recruiter.
          </p>
          <Disclosure checkout={checkout} />
        </section>
      </article>
    </main>
  );
}

function Disclosure({ checkout }: { checkout: boolean }) {
  return (
    <div className="pricing-fine-print">
      <h2>Before you subscribe</h2>
      <p>
        Seller: {sellerLine()} · {LEGAL.mailingAddress} · <a href={LEGAL.phoneTel}>{LEGAL.phone}</a> ·{" "}
        <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> · GST/HST {LEGAL.hstNumber}
      </p>
      <p>Prices, in Canadian dollars. No other fees.</p>
      <p>{taxLine()}</p>
      <p>
        Each plan renews automatically at the same price, plus applicable GST/HST, until you cancel. We email a
        reminder at least {LEGAL.yearlyReminderDays} days before a yearly renewal and at least {LEGAL.quarterReminderDays}{" "}
        days before a 3-month renewal. There is no free trial that turns into a charge, and there are no countdown
        timers. You create an account before you pay.
      </p>
      <p>
        You can cancel yourself on your Account page, by email or by phone. After you cancel, access continues until
        the end of the period you already paid for. {refundSentence()}
      </p>
      <p>
        A free account includes one resume match. Matching is never required to get the weekly email, and the weekly
        email is never required to match.
      </p>
      <p>Memberships are offered to people in {LEGAL.sellTo}.</p>
      <p>
        Terms version {LEGAL.termsVersion}. The full terms are on the <a href="/terms/">terms page</a>.
      </p>
      <p>PublicJobs.ca is independent and is not affiliated with any government or employer.</p>
      {checkout ? (
        <p>
          Check the plan and your Canadian billing province above. You can change them on this page before you
          continue. Your name is collected on the payment page. To decline, leave this page without paying.{" "}
          <a href="/">No thanks</a>
        </p>
      ) : null}
    </div>
  );
}

function PlanAction({
  signedIn,
  currentPlan,
  currentAndRenewing,
}: {
  signedIn: boolean;
  currentPlan: boolean;
  currentAndRenewing: boolean;
}) {
  if (!signedIn) {
    return (
      <a className="apply-btn" href="/login/?next=/pricing/">
        Choose plan
      </a>
    );
  }
  if (currentAndRenewing) return <span className="plan-current">Selected</span>;
  return (
    <form action={openPortal}>
      <button className="apply-btn secondary" type="submit">
        {currentPlan ? "Selected" : "Choose plan"}
      </button>
    </form>
  );
}
