import type { ReactNode } from "react";

const APPLY_NOTE =
  "For the latest details and the full posting, view this job on the employer's site.";

export function ApplyRow({ url, extra }: { url: string; extra?: ReactNode }) {
  if (!url && !extra) return null;
  return (
    <div className="apply-row">
      {url ? (
        <a className="apply-btn" href={url} target="_blank" rel="noopener noreferrer">
          Apply on employer site
        </a>
      ) : null}
      {extra}
      {url ? <p className="apply-note">{APPLY_NOTE}</p> : null}
    </div>
  );
}
