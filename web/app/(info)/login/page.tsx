import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer, localLoginAllowed, safeNext, supabaseConfigured } from "@/lib/auth";
import { googleSignInEnabled } from "@/lib/google-sign-in";
import { pageMetadata } from "@/lib/seo";
import { signInWithEmail, signInWithGoogle } from "../../login/actions";

export const metadata = pageMetadata({
  title: "Sign in | PublicJobs.ca",
  description: "Sign in to PublicJobs.ca with an email link. There is no password.",
  path: "/login/",
  index: false,
});

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  send: "The sign-in link could not be sent. Try again in a minute.",
  config: "Sign-in is not configured on this server yet.",
  local: "That email is not a local test account. On this computer, use test@example.com or free-match@example.com. No email is sent.",
  google: "Google sign-in needs a Supabase project with the Google provider turned on.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewer = await getViewer();
  const next = safeNext(typeof params.next === "string" ? params.next : "/account/");
  if (viewer.email) redirect(next);
  const h = await headers();
  const localOnly = !supabaseConfigured() && localLoginAllowed(h.get("host"));
  const google = googleSignInEnabled();
  const errorKey = typeof params.error === "string" ? params.error : "";
  const sent = params.sent === "1";

  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Sign in</h1>
        <section className="description">
          <p>
            Sign in with your email. To buy a membership, you can enter that email on the{" "}
            <a href="/pricing/#plans">membership page</a> and pay on Stripe without stopping here first. Applying for a
            job stays free, on the employer&apos;s site.
          </p>
          {localOnly ? (
            <p>On this computer, sign-in uses a local test account. No email is sent.</p>
          ) : (
            <p>We email you a sign-in link.{google ? " You can also use Google." : ""}</p>
          )}
          {sent ? (
            <p className="status ok" role="status">
              Check your email for a sign-in link.
            </p>
          ) : null}
          {ERRORS[errorKey] ? (
            <p className="status err" role="alert">
              {ERRORS[errorKey]}
            </p>
          ) : null}
          <form className="login-form" action={signInWithEmail}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              placeholder="you@example.com"
            />
            <input type="hidden" name="next" value={next} />
            <div className="login-actions">
              <button className="apply-btn" type="submit">
                {localOnly ? "Sign in" : "Email me a sign-in link"}
              </button>
            </div>
          </form>
          {google ? (
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <div className="login-actions">
                <button className="apply-btn secondary" type="submit">
                  Continue with Google
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </article>
    </main>
  );
}
