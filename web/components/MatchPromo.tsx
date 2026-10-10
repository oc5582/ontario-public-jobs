export function MatchPromo({ count }: { count: number }) {
  const noun = count === 1 ? "opening" : "openings";
  const lead = `Upload your resume and we'll check it against all ${count} ${noun}. You get your best matches, each with a reason why it fits.`;
  const steps = ["Upload your resume", "We check every opening", "See your matches"];
  return (
    <section className="match-promo" aria-labelledby="match-promo-heading">
      <div className="match-promo-panel">
        <div className="match-promo-copy">
          <p className="match-promo-kicker">New on PublicJobs.ca</p>
          <h2 id="match-promo-heading">See which jobs fit your resume</h2>
          <p className="match-promo-lead b2-desktop">{lead}</p>
          <p className="match-promo-lead b2-phone">Get your best matches from every opening, with a reason for each.</p>
          <a className="match-promo-btn" href="/match/">
            Match my resume
          </a>
          <p className="match-promo-fine b2-desktop">
            Free, up to 3 matches. Needs your email for job alerts. Your resume is not stored.
          </p>
          <p className="match-promo-fine b2-phone">Free, up to 3 matches.</p>
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
