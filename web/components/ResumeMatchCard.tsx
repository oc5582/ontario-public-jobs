import { MatchCardLoader } from "@/components/MatchCardLoader";
import { MatchForm } from "@/components/MatchForm";

/** Desktop job sidebar. Hidden in CSS below 1024px. */
export function ResumeMatchCard({
  jobId,
  employer,
  focusPath,
}: {
  jobId: string;
  employer: string;
  focusPath?: string;
}) {
  const handoffTo = `/match/?job=${encodeURIComponent(jobId)}`;
  return (
    <aside id="resume-match-card" className="resume-match-card" aria-labelledby="resume-match-heading" lang="en">
      <h2 id="resume-match-heading">Match your resume to thousands of public jobs in the GTA</h2>
      <MatchForm variant="compact" focusPath={focusPath} handoffTo={handoffTo} />
      <MatchCardLoader jobId={jobId} employer={employer} />
    </aside>
  );
}
