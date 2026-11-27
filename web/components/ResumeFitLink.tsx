"use client";

import { trackEvent } from "@/components/AnalyticsEvents";

export function ResumeFitLink({ jobId, employer }: { jobId: string; employer: string }) {
  return (
    <p className="resume-fit">
      <a
        href={`/match/?job=${encodeURIComponent(jobId)}`}
        onClick={() => trackEvent("job_resume_fit_click", { employer, job: jobId })}
      >
        Check how well your resume fits this job
      </a>
    </p>
  );
}
