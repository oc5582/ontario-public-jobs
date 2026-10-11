import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { refundSentence } from "@/lib/legal-copy";
import { membershipPeriodLabel } from "@/lib/membership";
import { pageMetadata } from "@/lib/seo";
import { PLANS } from "@/lib/site";
import { signOut } from "../../account/actions";
import { deleteMyAccount } from "../../account/delete-action";
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
  const checkout = typeof params.checkout === "string" ? params.checkout : "";
  const period = membershipPeriodLabel(profile);

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
          {period ? <p>{period}</p> : null}
          {checkout === "success" && viewer.isMember ? (
            <p className="status ok" role="status">
              Payment received. This membership is active.
            </p>
          ) : null}
          {checkout === "success" && !viewer.isMember ? (
            <p className="status" role="status">
              Stripe is confirming the payment. Refresh this page if the membership is not active yet.
            </p>
          ) : null}
          {notice === "stripe" ? (
            <p className="status err" role="status">
              Billing is not available right now.
            </p>
          ) : null}
          {notice === "portal" ? (
            <p className="status err" role="status">
              There is no billing account yet. Choose a membership first.
            </p>
          ) : null}
          <p className="login-actions">
            <a className="apply-btn" href="/pricing/">
              See membership plans
            </a>
          </p>
          <p>{refundSentence()}</p>
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
          {notice === "delete" ? (
            <p className="status err" role="alert">
              Check the box to confirm you want the account deleted.
            </p>
          ) : null}
          {notice === "cancel-first" ? (
            <p className="status err" role="alert">
              Cancel the membership from Manage billing before deleting the account.
            </p>
          ) : null}
          <form action={deleteMyAccount} className="account-delete">
            <h2>Delete account</h2>
            <p>
              This removes your profile and match history. Billing records the law requires, such as payment records,
              are kept. If a membership is still renewing, we cancel it first. If that cancellation cannot be completed,
              deletion waits until you cancel from Manage billing.
            </p>
            <label className="checkbox">
              <input type="checkbox" name="confirm" value="yes" required />
              <span>I understand this deletes my account.</span>
            </label>
            <button className="apply-btn secondary" type="submit">
              Delete account
            </button>
          </form>
        </section>
      </article>
    </main>
  );
}
