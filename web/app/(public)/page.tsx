import { HomeView } from "@/components/views/HomeView";
import { emptyFilters } from "@/lib/filters";
import { listingFacts } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { HOME_TITLE, homeCopy } from "@/lib/site";

export async function generateMetadata() {
  const facts = await listingFacts();
  const copy = homeCopy(facts.employerCount, facts.employerNames);
  return pageMetadata({
    title: HOME_TITLE,
    description: copy.description,
    path: "/",
  });
}

export default function HomePage() {
  return <HomeView filters={emptyFilters()} member={false} />;
}
