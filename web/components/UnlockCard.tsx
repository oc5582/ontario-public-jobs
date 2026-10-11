export function UnlockCard({ total, shown }: { total: number; shown: number }) {
  const remaining = Math.max(0, total - shown);
  if (remaining === 0) return null;
  const noun = remaining === 1 ? "opening" : "openings";
  return (
    <section className="unlock" aria-label="More openings">
      <h2>
        {remaining.toLocaleString("en-CA")} more {noun}
      </h2>
      <p>
        This list shows the newest {shown} of {total.toLocaleString("en-CA")}. The rest of the filtered list is part of
        a membership. Apply stays free on every job page.
      </p>
      <p className="unlock-actions">
        <a className="apply-btn" href="/pricing/">
          See membership
        </a>
        <a href="/login/">Sign in</a>
      </p>
    </section>
  );
}
