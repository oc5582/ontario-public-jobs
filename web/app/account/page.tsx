import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/ui";
import { memberState } from "@/lib/member";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Account | PublicJobs.ca",
  description: "Your PublicJobs.ca account and membership.",
  path: "/account/",
  noindex: true,
});

const STATUS_LABEL: Record<string, string> = {
  none: "No membership",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

export default async function AccountPage() {
  const member = await memberState();
  return (
    <>
      <SiteHeader current="account" />
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/">All openings</a>
          </p>
          <h1>Account</h1>
          <section className="description">
            {member.email ? (
              <>
                <p>Signed in as {member.email}{member.dev ? " (local test member)" : ""}.</p>
                <p>Membership: {STATUS_LABEL[member.status] || member.status}.</p>
                {member.member ? <p>You can see the full list of openings.</p> : <p>The full list is on the pricing page.</p>}
              </>
            ) : (
              <p>
                You are not signed in. <a href="/sign-in/">Sign in</a> to see your membership.
              </p>
            )}
            <p>
              <a href="/pricing/">Pricing</a>
            </p>
            {member.email ? (
              <form method="post" action="/api/billing/portal/">
                <button className="apply-btn" type="submit">
                  Manage billing
                </button>
              </form>
            ) : null}
            {member.email ? (
              <form method="post" action="/auth/sign-out/">
                <button type="submit">Sign out</button>
              </form>
            ) : null}
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
