import { notFound } from "next/navigation";
import { WeeklyMatchPanel } from "@/components/WeeklyMatchPanel";
import { pageMetadata } from "@/lib/seo";
import type { SavedResumeRow, WeeklyResultRow } from "@/lib/weekly-match-data";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Account | PublicJobs.ca",
  description: "Sample account view of saved resume and weekly matches.",
  path: "/account/weekly-sample/",
  index: false,
});

const saved: SavedResumeRow = {
  charCount: 1840,
  source: "pdf",
  filename: null,
  updatedAt: "2026-10-24T13:00:00.000Z",
};

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

/**
 * Paid-member mock for preview and local review. Production returns 404.
 * The resume text is not real and is not stored.
 */
export default function WeeklySamplePage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Account</h1>
        <section className="description">
          <p>
            Signed in as <strong>member@example.com</strong>.
          </p>
          <p>Membership: Active (Monthly, CA$14.99). The full filtered list is open.</p>
          <p className="status" role="note">
            Sample preview for a paid membership. This is not a real account, and no resume is stored on this page.
          </p>
          <WeeklyMatchPanel saved={saved} optedIn results={results} sample ready />
        </section>
      </article>
    </main>
  );
}
