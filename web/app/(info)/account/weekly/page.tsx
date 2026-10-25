import { redirect } from "next/navigation";
import { WeeklyResultsList } from "@/components/WeeklyMatchPanel";
import { getViewer } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { loadWeeklyAccount } from "@/lib/weekly-match-data";

export const metadata = pageMetadata({
  title: "This week’s matches | PublicJobs.ca",
  description: "The weekly job matches saved on your PublicJobs.ca account.",
  path: "/account/weekly/",
  index: false,
});

export default async function WeeklyListPage() {
  const viewer = await getViewer();
  if (!viewer.email || !viewer.profile) redirect("/login/?next=/account/weekly/");

  const results = viewer.isMember ? (await loadWeeklyAccount(viewer.profile.id)).results : null;

  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/account/">Account</a>
        </p>
        <h1>This week’s matches</h1>
        <section className="description weekly-results">
          {viewer.isMember ? (
            <WeeklyResultsList results={results} />
          ) : (
            <p>
              Weekly matches are part of a membership. <a href="/pricing/">See membership plans</a>
            </p>
          )}
          <p>
            <a href="/account/#weekly-matches">Back to your account</a>
          </p>
        </section>
      </article>
    </main>
  );
}
