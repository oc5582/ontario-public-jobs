import { ResumeMatchCardLink } from "@/components/ResumeMatchCardLink";

/** Quiet desktop sidebar. Hidden in CSS below 1024px so mobile markup does not show. */
export function ResumeMatchCard({ jobId, employer }: { jobId: string; employer: string }) {
  return (
    <aside className="resume-match-card" aria-labelledby="resume-match-heading" lang="en">
      <h2 id="resume-match-heading">Match your resume to thousands of public jobs in the GTA</h2>
      <p>Upload once, see which jobs fit you best.</p>
      <ResumeMatchCardLink jobId={jobId} employer={employer} />
    </aside>
  );
}
