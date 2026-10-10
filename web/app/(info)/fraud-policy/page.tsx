import { FraudPolicy } from "@/components/legal/FraudPolicy";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";

export const metadata = pageMetadata({
  title: `Fraudulent job postings | ${BRAND}`,
  description:
    "How PublicJobs.ca handles a report of a fake or suspicious job posting, and how to report one.",
  path: "/fraud-policy/",
});

export default function FraudPolicyPage() {
  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Fraudulent job postings</h1>
        <FraudPolicy />
      </article>
    </main>
  );
}
