import { notFound } from "next/navigation";
import { WeeklyResultsList } from "@/components/WeeklyMatchPanel";
import { pageMetadata } from "@/lib/seo";
import type { WeeklyResultRow } from "@/lib/weekly-match-data";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "This week’s matches | PublicJobs.ca",
  description: "Sample weekly match list for a paid membership.",
  path: "/account/weekly-sample/matches/",
  index: false,
});

const results: WeeklyResultRow = {
  ranAt: "2026-10-24T13:05:00.000Z",
  weekLabel: "Saturday, October 24, 2026",
  jobsChecked: 420,
  jobs: [
    {
      title: "Customer Service Clerk",
      employer: "City of Toronto",
      location: "Toronto",
      closing_date: "2026-11-06",
      url: "/jobs/city-of-toronto/customer-service-clerk/",
      reason: "Your eight years at a public counter fit helping residents with applications.",
    },
    {
      title: "Transit Ambassador",
      employer: "TTC",
      location: "Toronto",
      closing_date: "2026-11-12",
      url: "/jobs/ttc/transit-ambassador/",
      reason: "Your front-counter customer service fits helping riders at stations.",
    },
  ],
};

/** Preview of the member weekly list. Production returns 404. The jobs are not a real match. */
export default function WeeklySampleMatchesPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/account/weekly-sample/">Account</a>
        </p>
        <h1>This week’s matches</h1>
        <section className="description weekly-results">
          <p className="status" role="note">
            Sample preview. These are not real matches, and no resume is stored on this page.
          </p>
          <WeeklyResultsList results={results} />
        </section>
      </article>
    </main>
  );
}
