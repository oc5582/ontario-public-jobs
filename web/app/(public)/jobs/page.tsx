import { JobsView } from "@/components/views/JobsView";
import { emptyFilters } from "@/lib/filters";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";

export const metadata = pageMetadata({
  title: `All job openings | ${BRAND}`,
  description: "All current openings listed on PublicJobs.ca, collected from public employers' career sites.",
  path: "/jobs/",
});

export default function JobsPage() {
  return <JobsView filters={emptyFilters()} member={false} />;
}
