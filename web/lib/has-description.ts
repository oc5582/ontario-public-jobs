/** True when the job page has description text. Matches what JobView renders. */
export function hasDescription(job: { description?: string | null; paragraphs?: readonly string[] | null }): boolean {
  if ((job.description || "").trim()) return true;
  return Boolean(job.paragraphs && job.paragraphs.length > 0);
}
