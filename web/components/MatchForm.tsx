import type { ReactNode } from "react";
import { alertConsentLabel, alertConsentSender } from "@/lib/legal-copy";
import { FREE_RESULTS } from "@/lib/match";

const FILE_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * The resume match form used on /match/ and, in the compact variant, the desktop job card.
 * Submit behaviour lives in public/match.js. The compact card hands the same fields to /match/.
 */
export function MatchForm({
  variant = "page",
  signedIn = false,
  email = null,
  isMember = false,
  focusPath,
  handoffTo,
  turnstile = null,
}: {
  variant?: "page" | "compact";
  signedIn?: boolean;
  email?: string | null;
  isMember?: boolean;
  focusPath?: string;
  /** When set, match.js stores the fields and opens this URL instead of posting here. */
  handoffTo?: string;
  turnstile?: ReactNode;
}) {
  const compact = variant === "compact";
  const loginHref = handoffTo ? `/login/?next=${encodeURIComponent(handoffTo)}` : "/login/?next=/match/";
  const resumeFields = (
    <fieldset>
      <legend>{compact ? "Resume" : "2. Your resume"}</legend>
      <p className="hint">
        We use your resume only to find matching jobs. <a href="/privacy/">Privacy policy</a>
      </p>
      <label htmlFor="resume-file">Upload a PDF or Word file</label>
      <input type="file" id="resume-file" accept={FILE_ACCEPT} />
      <p className="hint" id="file-status" aria-live="polite">
        Your file stays on your device. Only the text is read.
      </p>
      <p className="or">Or paste your resume text</p>
      <label htmlFor="resume-text">Resume text</label>
      <textarea
        id="resume-text"
        rows={compact ? 3 : undefined}
        maxLength={15000}
        placeholder="Paste your work experience, education and skills"
      />
    </fieldset>
  );
  const honeypot = (
    <div className="hp" aria-hidden="true">
      <label htmlFor="gotcha">Leave this field blank</label>
      <input type="text" id="gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
    </div>
  );
  const submit = (
    <>
      <button type="submit" id="submit-btn">
        Find my jobs
      </button>
      {compact ? null : (
        <p className="hint">
          Your resume is read to find matches and is not stored. <a href="/privacy/">Privacy policy</a>
        </p>
      )}
      <div id="status" className="status" role="status" aria-live="polite" hidden />
    </>
  );

  if (compact) {
    return (
      <form
        id="match-form"
        className="match match-compact"
        noValidate
        method="post"
        action={handoffTo || "/match/"}
        data-focus-path={focusPath}
        data-match-handoff="1"
        data-match-next={handoffTo || "/match/"}
      >
        <fieldset>
          <legend>Email</legend>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            placeholder="you@example.com"
          />
          <p className="hint">
            Needed for your free match. It shows the top {FREE_RESULTS} jobs. Already a member?{" "}
            <a href={loginHref}>Sign in</a>
          </p>
          <label className="checkbox" htmlFor="consent">
            <input type="checkbox" id="consent" name="casl_consent" value="yes" />
            <span>
              {alertConsentLabel()} <a href="/privacy/">Privacy</a>
            </span>
          </label>
        </fieldset>
        {resumeFields}
        {honeypot}
        {submit}
      </form>
    );
  }

  if (signedIn) {
    return (
      <form id="match-form" noValidate data-focus-path={focusPath}>
        <fieldset>
          <legend>1. Job alerts, optional</legend>
          <p className="hint">Signed in as {email}.</p>
          {isMember ? (
            <p className="hint">A membership includes matches every day, up to 20 a day.</p>
          ) : (
            <p className="hint">Your account includes 1 free match. It shows the top {FREE_RESULTS} jobs.</p>
          )}
          <label className="checkbox" htmlFor="consent">
            <input type="checkbox" id="consent" name="casl_consent" value="yes" />
            <span>
              {alertConsentLabel()}
              <span className="consent-sender">{alertConsentSender()}</span>
            </span>
          </label>
          <p className="hint">Optional. Matching does not add you to the weekly email unless you check this.</p>
        </fieldset>
        {resumeFields}
        {honeypot}
        {turnstile}
        {submit}
      </form>
    );
  }

  return (
    <form id="match-form" noValidate data-focus-path={focusPath}>
      <fieldset>
        <legend>1. Your email</legend>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          placeholder="you@example.com"
        />
        <p className="hint">
          Needed for your free match. It shows the top {FREE_RESULTS} jobs. Already a member?{" "}
          <a href={loginHref}>Sign in</a>
        </p>
        <label className="checkbox" htmlFor="consent">
          <input type="checkbox" id="consent" name="casl_consent" value="yes" />
          <span>
            {alertConsentLabel()}
            <span className="consent-sender">{alertConsentSender()}</span>
          </span>
        </label>
        <p className="hint">Optional. We only send the weekly email if you check this.</p>
      </fieldset>
      {resumeFields}
      {honeypot}
      {turnstile}
      {submit}
    </form>
  );
}
