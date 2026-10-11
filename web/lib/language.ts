const TFO_SLUG = "ontario-french-language-educational-communications-authority-tfo";

/** A standalone FR tag, such as "- FR 328" or "696 FR -". Not a letter inside a word. */
const FR_TAG = /(?:^|[^A-Za-zÀ-ÿ])FR(?:[^A-Za-zÀ-ÿ]|$)/;

/**
 * The feed has no language field. This stays conservative: a TFO posting, or a
 * title with a standalone FR tag. A wrong French label is worse than a missed one.
 */
export function isFrench(job: { title?: string | null; employer_slug?: string | null }): boolean {
  if ((job.employer_slug || "") === TFO_SLUG) return true;
  return FR_TAG.test(job.title || "");
}
