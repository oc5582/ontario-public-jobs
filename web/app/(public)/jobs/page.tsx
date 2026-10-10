import { JobsView } from "@/components/views/JobsView";
import { emptyFilters } from "@/lib/filters";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";

export const metadata = pageMetadata({
  title: `All job openings | ${BRAND}`,
  description: "Every current public-sector job opening in Toronto and the GTA listed on PublicJobs.ca.",
  path: "/jobs/",
});

export default function JobsPage() {
  return <JobsView filters={emptyFilters()} member={false} />;
}
