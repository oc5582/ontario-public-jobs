const APPLY_NOTE =
  "For the latest details and the full posting, view this job on the employer's site.";

export function ApplyRow({ url }: { url: string }) {
  if (!url) return null;
  return (
    <div className="apply-row">
      <a className="apply-btn" href={url} target="_blank" rel="noopener noreferrer">
        Apply on employer site
      </a>
      <p className="apply-note">{APPLY_NOTE}</p>
    </div>
  );
}
