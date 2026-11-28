"use client";

import { trackEvent } from "@/components/AnalyticsEvents";

export function ResumeMatchCardLink({ jobId, employer }: { jobId: string; employer: string }) {
  return (
    <a
      className="resume-match-card-btn"
      href={`/match/?job=${encodeURIComponent(jobId)}`}
      onClick={() => trackEvent("job_resume_card_click", { employer, job: jobId })}
    >
      Match my resume
    </a>
  );
}
