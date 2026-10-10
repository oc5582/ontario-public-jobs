import { getViewer } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: `Match your resume to public-sector jobs | ${BRAND}`,
  description:
    "Upload your resume and see which current public sector jobs in Toronto and the GTA fit your experience. Free, 1 match. Sign in to use it. Your resume is not stored.",
  path: "/match/",
});

export default async function MatchPage() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.email && viewer.profile);

  return (
    <main className="match">
      <h1>Match your resume</h1>
      <p className="lede">
        Add your resume and we will check it against every current opening on PublicJobs.ca. We show any job you might
        qualify for, so you do not miss one. Free, 1 match. Sign in to use it.
      </p>

      {signedIn ? (
        <form id="match-form" noValidate>
          <fieldset>
            <legend>1. Job alerts, optional</legend>
            <p className="hint">Signed in as {viewer.email}.</p>
            {viewer.isMember ? (
              <p className="hint">A membership includes matches every day, up to 20 a day.</p>
            ) : (
              <p className="hint">Your account includes 1 free match. It shows the top 5 jobs.</p>
            )}
            <label className="checkbox" htmlFor="consent">
              <input type="checkbox" id="consent" name="casl_consent" value="yes" />
              <span>Email me new jobs once a week. I can unsubscribe anytime.</span>
            </label>
            <p className="hint">Optional. Matching does not add you to the weekly email unless you check this.</p>
          </fieldset>

          <fieldset>
            <legend>2. Your resume</legend>
            <p className="hint">
              We use your resume only to find matching jobs. <a href="/privacy/">Privacy policy</a>
            </p>
            <label htmlFor="resume-file">Upload a PDF or Word file</label>
            <input
              type="file"
              id="resume-file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
            <p className="hint" id="file-status" aria-live="polite">
              Your file stays on your device. Only the text is read.
            </p>
            <p className="or">Or paste your resume text</p>
            <label htmlFor="resume-text">Resume text</label>
            <textarea
              id="resume-text"
              maxLength={15000}
              placeholder="Paste your work experience, education and skills"
            />
          </fieldset>

          <div className="hp" aria-hidden="true">
            <label htmlFor="gotcha">Leave this field blank</label>
            <input type="text" id="gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
          </div>

          <button type="submit" id="submit-btn">
            Find my jobs
          </button>
          <p className="hint">
            Your resume is read to find matches and is not stored. <a href="/privacy/">Privacy policy</a>
          </p>
          <div id="status" className="status" role="status" aria-live="polite" hidden />
        </form>
      ) : (
        <section className="unlock" aria-label="Sign in to match">
          <h2>Sign in to match your resume</h2>
          <p>
            The free match is saved on your account, so it is counted once per person. Job alert emails stay optional.
          </p>
          <p className="unlock-actions">
            <a className="apply-btn" href="/login/?next=/match/">
              Sign in
            </a>
          </p>
        </section>
      )}

      <section id="results" hidden aria-labelledby="results-title">
        <h2 id="results-title" tabIndex={-1}>
          Your matches
        </h2>
        <p id="results-summary" />
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
