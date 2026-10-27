import { PricingView } from "@/components/AnalyticsEvents";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PricingRenewal, PricingSignIn, PricingTrust } from "@/components/PricingPlans";
import { getViewer } from "@/lib/auth";
import { CA_TAX_JURISDICTIONS } from "@/lib/ca-tax";
import { emptyFilters } from "@/lib/filters";
import { searchJobs } from "@/lib/jobs";
import { LEGAL } from "@/lib/legal-config";
import { refundSentence, sellerLine, taxLine } from "@/lib/legal-copy";
import { membershipPeriodLabel } from "@/lib/membership";
import { pageMetadata } from "@/lib/seo";
import { FREE_LIST_LIMIT, PLANS, planPriceLine, pricingPlanFromQuery } from "@/lib/site";
import { formatCount } from "@/lib/stats";
import { publicJobStats } from "@/lib/stats-data";
import type { Profile } from "@/lib/types";
import { openPortal, startCheckout } from "../../billing/actions";

export const metadata = pageMetadata({
  title: "Membership | PublicJobs.ca",
  description:
    "Get GTA government jobs that match your resume emailed every week, plus the full list of current openings. From CA$10 a month on the 3-month plan, plus GST/HST. Apply stays free.",
  path: "/pricing/",
});

/**
 * Storage and deletion, matching /privacy/. Quoted in the pricing v2 PR for approval.
 * The Match page does not keep a resume. A resume saved on the account is text only.
 */
const RESUME_FAQ =
  "A resume you save on your account for weekly matches is stored as text only (up to 15,000 characters, not the file), used only to find matching jobs, shown only to you, never sent to employers, and deleted when you remove it or delete your account. A resume used on the Match page is not stored.";

function noun(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, viewer, list, stats] = await Promise.all([
    searchParams,
    getViewer(),
    searchJobs(emptyFilters(), false),
    publicJobStats(),
  ]);
  const notice = typeof params.notice === "string" ? params.notice : "";
  const requestedPlan = typeof params.plan === "string" ? params.plan : "";
  const initialPlan = pricingPlanFromQuery(requestedPlan);
  const profile = viewer.profile;
  const subscribedProfile =
    profile &&
    profile.stripe_subscription_id &&
    (profile.membership_status === "active" || profile.membership_status === "past_due")
      ? profile
      : null;
  const checkout = Boolean(viewer.email) && !subscribedProfile;
  const total = list.total;
  const remaining = Math.max(0, total - FREE_LIST_LIMIT);
  const employers = stats.employerCount;
  const over100k = stats.topOfRangeAtLeast100k;
  const totalLabel = formatCount(total);
  const employerLabel = formatCount(employers);
  const employerWord = noun(employers, "employer", "employers");
  const siteWord = noun(employers, "site", "sites");

  return (
    <main>
      <PricingView />
      <article className="content pricing-v2">
        <p className="pricing-eyebrow">
          You&apos;ve seen the newest {FREE_LIST_LIMIT}.{" "}
          <strong>
            {formatCount(remaining)} more {noun(remaining, "opening", "openings")}
          </strong>{" "}
          are on the full list.
        </p>
        <h1>Get government jobs that fit your resume, in your inbox every week.</h1>
        <p className="pricing-lede">
          Send us your resume once. Every week we email you the new GTA public-sector openings that match it. You also
          get the full list of all {totalLabel} {noun(total, "opening", "openings")}, with filters.
        </p>

        <div className="pricing-proof" aria-label="Current numbers">
          <div>
            <b>{totalLabel}</b>
            <span>{noun(total, "open job today", "open jobs today")}</span>
          </div>
          <div>
            <b>{employerLabel}</b>
            <span>GTA public {employerWord}</span>
          </div>
          <div>
            <b>{formatCount(over100k)}</b>
            <span>paying over $100k</span>
          </div>
          <div>
            <b>Daily</b>
            <span>new jobs every weekday</span>
          </div>
        </div>

        <section id="plans" aria-labelledby="plans-h">
          <h2 id="plans-h">Choose your plan</h2>
          <Notices notice={notice} />
          {subscribedProfile ? (
            <MemberBilling profile={subscribedProfile} />
          ) : checkout ? (
            <CheckoutForm
              action={startCheckout}
              initialPlan={initialPlan}
              provinces={CA_TAX_JURISDICTIONS.map((item) => ({
                code: item.code,
                label: `${item.name} (${item.displayName} ${item.percentage}%${item.code === "QC" ? ", GST only" : ""})`,
              }))}
            />
          ) : (
            <PricingSignIn initialPlan={initialPlan} />
          )}
        </section>

        <section aria-labelledby="get-h">
          <h2 id="get-h">What members get</h2>
          <ul className="pricing-benefits">
            <li className="is-lead">
              <b>Your matched jobs, every week</b>
              <span>New openings that fit your resume, by email and in your account. No searching.</span>
            </li>
            <li>
              <b>
                All {totalLabel} {noun(total, "opening", "openings")}
              </b>
              <span>Filter by pay, location, employer, job type and closing date.</span>
            </li>
            <li>
              <b>Up to 20 resume matches a day</b>
              <span>Each match comes with a short reason. Matches are suggestions and can be wrong.</span>
            </li>
            <li>
              <b>&quot;Jobs I applied to&quot;</b>
              <span>Keep track of where you applied, even after a posting closes.</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="cmp-h">
          <h2 id="cmp-h">Free vs member</h2>
          <table className="pricing-compare">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Feature</span>
                </th>
                <th className="c" scope="col">
                  Free
                </th>
                <th className="c" scope="col">
                  Member
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Every job page and Apply link</td>
                <td className="c pricing-yes">Yes</td>
                <td className="c pricing-yes">Yes</td>
              </tr>
              <tr>
                <td>Newest {FREE_LIST_LIMIT} jobs on each list</td>
                <td className="c pricing-yes">Yes</td>
                <td className="c pricing-yes">Yes</td>
              </tr>
              <tr>
                <td>Weekly email of new openings</td>
                <td className="c pricing-yes">Yes</td>
                <td className="c pricing-yes">Yes</td>
              </tr>
              <tr>
                <td>Resume matches</td>
                <td className="c">1</td>
                <td className="c pricing-yes">20 a day</td>
              </tr>
              <tr>
                <td>
                  <b>Weekly jobs matched to your resume</b>
                </td>
                <td className="c pricing-no">No</td>
                <td className="c pricing-yes">Yes</td>
              </tr>
              <tr>
                <td>
                  Full list with filters ({totalLabel} {noun(total, "opening", "openings")})
                </td>
                <td className="c pricing-no">No</td>
                <td className="c pricing-yes">Yes</td>
              </tr>
              <tr>
                <td>&quot;Jobs I applied to&quot; list</td>
                <td className="c pricing-no">No</td>
                <td className="c pricing-yes">Yes</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section aria-labelledby="quotes-h">
          <h2 id="quotes-h">What people say about it</h2>
          <div className="pricing-quotes">
            <blockquote>
              <p>&quot;I like that new jobs show up every day. The list always feels current.&quot;</p>
              <cite>Daniel M., early user</cite>
            </blockquote>
            <blockquote>
              <p>&quot;I was impressed by the resume match. The jobs it suggested actually fit my background.&quot;</p>
              <cite>Amira K., early user</cite>
            </blockquote>
          </div>
          <p className="pricing-tax">Names changed for privacy. Feedback shortened.</p>
        </section>

        <section aria-labelledby="why-h">
          <h2 id="why-h">Why does this cost money?</h2>
          <div className="pricing-note">
            <p>I&apos;m Osama, and I run PublicJobs.ca on my own in Toronto.</p>
            <p>
              Every weekday, the site reads the careers pages of {employerLabel} public {employerWord} across 17
              different hiring systems, so you don&apos;t have to check them one by one. Your membership pays for that
              work.
            </p>
            <p>
              Employers never pay to be listed, so no job is pushed to the top. Apply always goes straight to the
              employer&apos;s own posting.
            </p>
            <p className="pricing-sig">
              Osama Chaudhary{" "}
              <span>
                | <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
              </span>
            </p>
          </div>
        </section>

        <section aria-labelledby="faq-h">
          <h2 id="faq-h">Questions</h2>
          <div className="pricing-faq">
            <details>
              <summary>Is this a government site?</summary>
              <div className="pricing-faq-body">
                <p>
                  No. PublicJobs.ca is an independent job board. It is not affiliated with any government or employer.
                  Every Apply link goes to the employer&apos;s own posting.
                </p>
              </div>
            </details>
            <details>
              <summary>Will a membership get me a job?</summary>
              <div className="pricing-faq-body">
                <p>
                  No. It&apos;s a search tool, not a recruiter. It saves you time and helps you not miss a posting.
                  Hiring decisions are made by each employer.
                </p>
              </div>
            </details>
            <details>
              <summary>How do the weekly matches work?</summary>
              <div className="pricing-faq-body">
                <p>
                  After you join, you add your resume. Every week we compare it with the new openings and email you the
                  ones that look like a fit. The same list is in your account.
                </p>
              </div>
            </details>
            <details>
              <summary>What happens to my resume?</summary>
              <div className="pricing-faq-body">
                <p>{RESUME_FAQ}</p>
              </div>
            </details>
            <details>
              <summary>Why pay when employer sites are free?</summary>
              <div className="pricing-faq-body">
                <p>
                  Job pages and Apply stay free here too. You pay to skip checking {employerLabel} careers {siteWord},
                  and to have the jobs that fit you sent to you each week.
                </p>
              </div>
            </details>
            <details>
              <summary>How do I cancel or get a refund?</summary>
              <div className="pricing-faq-body">
                <p>
                  Cancel yourself on your Account page, by email or by phone. You keep access until the end of the
                  period you paid for. If it&apos;s not for you, email us within {LEGAL.refundWindowDays} days of a
                  purchase or renewal for a full refund.
                </p>
              </div>
            </details>
          </div>
        </section>

        <section className="pricing-final" aria-labelledby="final-h">
          <h2 id="final-h">
            Stop checking {employerLabel} careers {siteWord}.
          </h2>
          <p className="pricing-cta-note">Get the jobs that fit you, every week.</p>
          <a className="pricing-cta" href="#plans">
            Choose a plan
          </a>
          <p className="pricing-cta-note">Apply stays free on every job page.</p>
        </section>

        <section aria-labelledby="legal-h">
          <h2 id="legal-h" className="pricing-legal-heading">
            Before you subscribe
          </h2>
          <details className="pricing-legal">
            <summary>Seller, taxes, renewals and refunds</summary>
            <div className="pricing-legal-body">
              <Disclosure checkout={checkout} />
            </div>
          </details>
        </section>
      </article>
    </main>
  );
}

function Notices({ notice }: { notice: string }) {
  if (notice === "stripe") {
    return (
      <p className="status err" role="status">
        Billing is not available right now.
      </p>
    );
  }
  if (notice === "plan") {
    return (
      <p className="status err" role="alert">
        Choose one of the three memberships below.
      </p>
    );
  }
  if (notice === "terms") {
    return (
      <p className="status err" role="alert">
        Check the box to agree to the Terms before continuing.
      </p>
    );
  }
  if (notice === "province") {
    return (
      <p className="status err" role="alert">
        Choose your Canadian billing province so GST/HST can be added.
      </p>
    );
  }
  return null;
}

function MemberBilling({ profile }: { profile: Profile }) {
  const current = PLANS.find((item) => item.id === profile.plan);
  const period = membershipPeriodLabel(profile);
  return (
    <>
      {current ? (
        <p className="pricing-current">
          Your plan is {current.name} ({planPriceLine(current.id)}). {period}
        </p>
      ) : (
        <p className="pricing-current">Your plan is active. {period}</p>
      )}
      <form action={openPortal}>
        <button className="pricing-cta" type="submit">
          Manage billing
        </button>
      </form>
      {current ? <PricingRenewal plan={current.id} /> : null}
      <PricingTrust />
    </>
  );
}

function Disclosure({ checkout }: { checkout: boolean }) {
  return (
    <>
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
        One resume match is free, with or without an account. Matching is never required to get the weekly email, and the
        weekly email is never required to match.
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
    </>
  );
}
