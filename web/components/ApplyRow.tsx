import { TrackedApplyLink } from "@/components/TrackedApplyLink";
import type { ReactNode } from "react";

const APPLY_NOTE =
  "For the latest details and the full posting, view this job on the employer's site.";

export function ApplyRow({
  url,
  extra,
  track,
}: {
  url: string;
  extra?: ReactNode;
  track?: { employer: string; job: string; position: "top" | "bottom" };
}) {
  if (!url && !extra) return null;
  return (
    <div className="apply-row">
      {url ? (
        <div className="apply-actions">
          {track ? (
            <TrackedApplyLink href={url} employer={track.employer} jobId={track.job} position={track.position} />
          ) : (
            <a className="apply-btn" href={url} target="_blank" rel="noopener noreferrer">
              Apply on employer site
            </a>
          )}
        </div>
      ) : null}
      {extra}
      {url ? <p className="apply-note">{APPLY_NOTE}</p> : null}
    </div>
  );
}
