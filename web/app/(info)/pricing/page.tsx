import { getViewer } from "@/lib/auth";
import { membershipPeriodLabel } from "@/lib/membership";
import { pageMetadata } from "@/lib/seo";
import { PLANS, type PlanId } from "@/lib/site";
import { openPortal, startCheckout } from "../../billing/actions";

export const metadata = pageMetadata({
  title: "Membership | PublicJobs.ca",
  description:
    "PublicJobs.ca membership prices: CA$14.99 a month, CA$29.99 for 3 months, or CA$59 a year. Applying stays free.",
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
            openings. Employers are never charged.
          </p>
          {subscribed && current && profile ? (
            <p>
              Your plan is {current.name} ({current.price} {current.period}). {membershipPeriodLabel(profile)}
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
          <ul className="plan-list">
            {PLANS.map((plan) => (
              <li key={plan.id}>
                <span className="plan-name">{plan.name}</span>
                <span className="plan-price">
                  {plan.price} {plan.period}
                </span>
                <span>{plan.detail}</span>
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
            end of the period you already paid for. You can ask for a refund within 14 days of a purchase by emailing{" "}
            <a href="mailto:hello@publicjobs.ca">hello@publicjobs.ca</a>.
          </p>
          <p>
            The weekly email stays free. An active membership includes 20 resume matches a day. A free account includes
            one match.
          </p>
        </section>
      </article>
    </main>
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
      <button className="apply-btn" type="submit">
        Continue
      </button>
    </form>
  );
}
