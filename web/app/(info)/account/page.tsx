import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { formatLongDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { PLANS } from "@/lib/site";
import { signOut } from "../../account/actions";
import { openPortal } from "../../billing/actions";

export const metadata = pageMetadata({
  title: "Account | PublicJobs.ca",
  description: "Your PublicJobs.ca account and membership.",
  path: "/account/",
  index: false,
});

const STATUS: Record<string, string> = {
  none: "No membership",
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  if (!viewer.email || !viewer.profile) redirect("/login/?next=/account/");
  const params = await searchParams;
  const profile = viewer.profile;
  const plan = PLANS.find((item) => item.id === profile.plan);
  const notice = typeof params.notice === "string" ? params.notice : "";

  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Account</h1>
        <section className="description">
          <p>
            Signed in as <strong>{viewer.email}</strong>.
          </p>
          <p>
            Membership: {STATUS[profile.membership_status] || profile.membership_status}
            {plan ? ` (${plan.name}, ${plan.price})` : ""}.
            {viewer.isMember ? " The full filtered list is open." : " The lists still show the newest 10."}
          </p>
          {profile.current_period_end ? (
            <p>Current period ends {formatLongDate(profile.current_period_end.slice(0, 10))}.</p>
          ) : null}
          {notice === "stripe" || notice === "portal" ? (
            <p className="status err" role="status">
              The Stripe customer portal is not connected yet.
            </p>
          ) : null}
          <p className="login-actions">
            <a className="apply-btn" href="/pricing/">
              {viewer.isMember ? "See membership" : "Choose a membership"}
            </a>
          </p>
          <form action={openPortal}>
            <button className="apply-btn secondary" type="submit">
              Manage billing
            </button>
          </form>
          <form action={signOut}>
            <button className="apply-btn secondary" type="submit">
              Sign out
            </button>
          </form>
        </section>
      </article>
    </main>
  );
}
