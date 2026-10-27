import { redirect } from "next/navigation";
import { CheckoutSignInRequest } from "@/components/CheckoutSignInRequest";
import { getViewer } from "@/lib/auth";
import { loadCheckoutReturn } from "@/lib/checkout-return";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Payment received | PublicJobs.ca",
  description: "Your PublicJobs.ca membership payment, and the sign-in link for your account.",
  path: "/checkout/return/",
  index: false,
});

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notice = typeof params.notice === "string" ? params.notice : "";
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const result = sessionId ? await loadCheckoutReturn(sessionId) : { ok: false as const, reason: "missing" as const };
  const viewer = await getViewer();

  if (result.ok && viewer.email && result.email && viewer.email.toLowerCase() === result.email.toLowerCase()) {
    redirect(`/account/?checkout=success&session_id=${encodeURIComponent(result.sessionId)}`);
  }

  const reason = result.ok ? "" : result.reason;
  const auto = result.ok && !result.signInAlreadySent && notice !== "sent" && notice !== "rate" && notice !== "send";

  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Payment</h1>
        <section className="description">
          {result.ok ? (
            <>
              <p className="status ok" role="status">
                Payment received{result.email ? ` for ${result.email}` : ""}. Your membership is being added to that
                account.
              </p>
              {notice === "sent" ? (
                <p className="status ok" role="status">
                  Check your email for a sign-in link. Open it in this browser. There is no password.
                </p>
              ) : null}
              {notice === "rate" ? (
                <p className="status" role="status">
                  A sign-in link was just sent. Wait a minute, then try again.
                </p>
              ) : null}
              {notice === "send" ? (
                <p className="status err" role="alert">
                  The sign-in link could not be sent. Try again in a minute.
                </p>
              ) : null}
              {result.signInAlreadySent && notice !== "sent" ? (
                <p>
                  We emailed a sign-in link when you entered your email. Open it in this browser to reach your account.
                  The membership can take a moment to show after you sign in.
                </p>
              ) : (
                <p>We email a one-time sign-in link so you can open your account. Open that link in this browser.</p>
              )}
              {result.email ? <CheckoutSignInRequest sessionId={result.sessionId} auto={auto} /> : null}
              <p>
                You can also request a link on the <a href="/login/?next=/account/">sign-in page</a>. Use the same
                email you paid with.
              </p>
            </>
          ) : null}
          {reason === "unpaid" || notice === "unpaid" ? (
            <p className="status err" role="alert">
              This payment is not complete. You have not been charged for a new membership.{" "}
              <a href="/pricing/#plans">Back to membership</a>
            </p>
          ) : null}
          {reason === "unavailable" || notice === "unavailable" ? (
            <p className="status err" role="status">
              Billing is not available right now.
            </p>
          ) : null}
          {!result.ok && reason !== "unpaid" && reason !== "unavailable" ? (
            <p className="status err" role="alert">
              We could not find that payment. <a href="/pricing/#plans">Back to membership</a>
            </p>
          ) : null}
        </section>
      </article>
    </main>
  );
}
