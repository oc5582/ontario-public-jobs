export function SignupForm() {
  return (
    <section className="signup signup-compact" aria-labelledby="signup-heading">
      <form id="signup-form" method="post" noValidate>
        <div className="signup-compact-row">
          <h2 id="signup-heading" className="signup-compact-heading">
            <span className="b2-desktop">Or get new openings by email</span>
            <span className="b2-phone">New openings by email</span>
          </h2>
          <div className="signup-compact-fields">
            <label id="email-label" htmlFor="email" className="visually-hidden">
              Email
            </label>
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
            <button type="submit" id="submit-btn">
              <span className="b2-desktop">Email me new openings</span>
              <span className="b2-phone">Sign up</span>
            </button>
          </div>
        </div>
        <label className="checkbox signup-compact-consent" htmlFor="consent">
          <input type="checkbox" id="consent" name="casl_consent" value="yes" required />
          <span id="casl-label">
            I agree to receive job alert emails from PublicJobs.ca at this address. I can unsubscribe anytime.
          </span>
          <span className="b2-phone b2-consent">
            I agree to job alert emails from PublicJobs.ca. Unsubscribe anytime. <a href="/privacy/">Privacy</a>
          </span>
          <span className="signup-compact-links">
            <a href="/privacy/">Privacy</a> <a href="/terms/">Terms</a>
          </span>
        </label>
        <div className="hp" aria-hidden="true">
          <label htmlFor="gotcha">Leave this field blank</label>
          <input type="text" id="gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </div>
        <div id="signup-status" className="status" role="status" aria-live="polite" hidden />
      </form>
    </section>
  );
}
