"use client";

import { trackEvent } from "@/components/AnalyticsEvents";

export function TrackedApplyLink({
  href,
  employer,
  jobId,
  position,
}: {
  href: string;
  employer: string;
  jobId: string;
  position: "top" | "bottom";
}) {
  return (
    <a
      className="apply-btn"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("job_apply_click", { employer, job: jobId, position })}
    >
      Apply on employer site
    </a>
  );
}
