export function MatchPromo({ count }: { count: number }) {
  const noun = count === 1 ? "opening" : "openings";
  const lead = `We compare your resume with each current opening (${count} ${noun} right now) and show the ones that look like a fit, with a short reason. Matches are suggestions and can be wrong.`;
  const steps = ["Upload your resume", "We compare it with current openings", "See suggestions"];
  return (
    <section className="match-promo" aria-labelledby="match-promo-heading">
      <div className="match-promo-panel">
        <div className="match-promo-copy">
          <p className="match-promo-kicker">New on PublicJobs.ca</p>
          <h2 id="match-promo-heading">See which jobs fit your resume</h2>
          <p className="match-promo-lead b2-desktop">{lead}</p>
          <p className="match-promo-lead b2-phone">
            See openings that look like a fit, with a short reason. Suggestions can be wrong.
          </p>
          <a className="match-promo-btn" href="/match/">
            Match my resume
          </a>
          <p className="match-promo-fine b2-desktop">
            Free, 1 match. Sign in to use it. Your resume is not stored.
          </p>
          <p className="match-promo-fine b2-phone">Free, 1 match.</p>
        </div>
        <ol className="match-promo-steps">
          {steps.map((label, index) => (
            <li key={label}>
              <span className="match-promo-num" aria-hidden="true">
                {index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
