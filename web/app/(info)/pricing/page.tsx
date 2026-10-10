import { getViewer } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { PLANS } from "@/lib/site";
import { startCheckout } from "../../billing/actions";

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
          {notice === "stripe" ? (
            <p className="status err" role="status">
              Stripe Checkout is not connected yet. Your account is ready. Payment will be added later.
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
                {viewer.email ? (
                  <form action={startCheckout}>
                    <input type="hidden" name="plan" value={plan.id} />
                    <button className="apply-btn" type="submit">
                      Continue
                    </button>
                  </form>
                ) : (
                  <a className="apply-btn" href={`/login/?next=/pricing/`}>
                    Sign in to continue
                  </a>
                )}
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
            The weekly email stays free. Resume matching on this site still uses the current free limit until payments
            are connected.
          </p>
        </section>
      </article>
    </main>
  );
}
