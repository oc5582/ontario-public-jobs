import { cookies } from "next/headers";
import { MatchForm } from "@/components/MatchForm";
import { TurnstileField } from "@/components/TurnstileField";
import { getViewer } from "@/lib/auth";
import { jobForMatch } from "@/lib/jobs";
import { FREE_COOKIE, FREE_RESULTS, FREE_RUNS_PER_EMAIL, cookieRuns } from "@/lib/match";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: `Match your resume to public-sector jobs | ${BRAND}`,
  description:
    "Upload your resume and see which current public sector jobs in Toronto and the GTA fit your experience. One free match, no account needed. Your resume is not stored.",
  path: "/match/",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function oneParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default async function MatchPage({ searchParams }: Props) {
  const [params, viewer, cookieStore] = await Promise.all([searchParams, getViewer(), cookies()]);
  const signedIn = Boolean(viewer.email && viewer.profile);
  const guestUsed = !signedIn && cookieRuns(cookieStore.get(FREE_COOKIE)?.value) >= FREE_RUNS_PER_EMAIL;
  const focus = await jobForMatch(oneParam(params.job));
  const focusPath = focus?.path || undefined;
  const turnstile = <TurnstileField action="match" />;

  return (
    <main className="match">
      <h1>Match your resume</h1>
      <p className="lede">
        Add your resume. We compare it with the current openings on PublicJobs.ca and show the ones that look like a
        fit, with a short reason. Matches are suggestions and can be wrong.
        {viewer.isMember
          ? " Matching does not require job alerts."
          : ` One match is free and shows the top ${FREE_RESULTS}. No account needed, just your email. Matching does not require job alerts.`}
      </p>
      {focus ? (
        <p className="match-focus">
          Checking how your resume fits <a href={focus.href}>{focus.title}</a>
          {focus.employer ? ` at ${focus.employer}` : ""}. It is compared with the other current openings too.
        </p>
      ) : null}

      {signedIn ? (
        <MatchForm
          signedIn
          email={viewer.email}
          isMember={viewer.isMember}
          focusPath={focusPath}
          turnstile={turnstile}
        />
      ) : guestUsed ? (
        <section className="unlock" id="free-used" aria-label="Free match used">
          <h2>You&apos;ve used your free match</h2>
          <p>
            A membership includes up to 20 matches a day and the full list of openings. Apply stays free on every job
            page.
          </p>
          <p className="unlock-actions">
            <a className="apply-btn" href="/pricing/">
              See membership
            </a>
            <a href="/login/?next=/match/">Sign in</a>
          </p>
        </section>
      ) : (
        <MatchForm focusPath={focusPath} turnstile={turnstile} />
      )}

      <section id="results" hidden aria-labelledby="results-title">
        <h2 id="results-title" tabIndex={-1}>
          Your matches
        </h2>
        <p id="results-summary" />
        {viewer.isMember ? (
          <>
            <label className="checkbox" htmlFor="hide-applied">
              <input type="checkbox" id="hide-applied" />
              <span>Hide jobs I applied to</span>
            </label>
            <p id="applied-empty" className="hint" hidden>
              All of these matches are jobs you marked as applied.
            </p>
          </>
        ) : null}
        <div id="strong-wrap" hidden>
          <h2>Strong matches</h2>
          <ol className="results" id="strong-list" />
        </div>
        <div id="maybe-wrap" hidden>
          <h2>Worth a look</h2>
          <p className="hint">These are related to your experience or could be a step up. Read the posting to decide.</p>
          <ol className="results" id="maybe-list" />
        </div>
        <section id="unlock" className="unlock" hidden aria-label="More matches" />
        <p>
          <a href="/">See all openings</a>
        </p>
      </section>
    </main>
  );
}
