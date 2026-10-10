import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/ui";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Pricing | PublicJobs.ca",
  description: "See every current opening on PublicJobs.ca. CA$14.99 a month, CA$29.99 for 3 months, or CA$59 a year. 14-day refund. Cancel anytime.",
  path: "/pricing/",
});

const PLANS = [
  { code: "monthly", name: "Monthly", price: "CA$14.99", period: "per month", detail: "Billed every month." },
  { code: "quarterly", name: "3 months", price: "CA$29.99", period: "every 3 months", detail: "Billed every three months." },
  { code: "annual", name: "Yearly", price: "CA$59", period: "per year", detail: "Billed once a year." },
] as const;

export default function PricingPage() {
  return (
    <>
      <SiteHeader current="pricing" />
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/">All openings</a>
          </p>
          <h1>See all the openings</h1>
          <section className="description">
            <p>
              Job pages stay public, and applying is always free on the employer&apos;s site. A membership shows the full filtered list instead of the 10 newest openings.
            </p>
            <p>Create an account before you pay. You can cancel yourself. If you cancel within 14 days of a payment, we refund that payment.</p>
          </section>
          <div className="price-grid">
            {PLANS.map((plan) => (
              <form key={plan.code} className="price-card" method="post" action="/api/checkout/">
                <h2>{plan.name}</h2>
                <p className="price">
                  {plan.price} <span>{plan.period}</span>
                </p>
                <p>{plan.detail}</p>
                <input type="hidden" name="plan" value={plan.code} />
                <button className="apply-btn" type="submit">
                  Choose {plan.name.toLowerCase()}
                </button>
              </form>
            ))}
          </div>
          <section className="description">
            <p className="fine">
              Payment is not turned on yet. Choosing a plan tells you that, and does not charge you. When Stripe is connected, this button opens Checkout and the account page opens the customer portal so you can cancel.
            </p>
            <p>
              Already a member? <a href="/sign-in/">Sign in</a>.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
