import { HomeView } from "@/components/views/HomeView";
import { emptyFilters } from "@/lib/filters";
import { pageMetadata } from "@/lib/seo";
import { BRAND, META_DESCRIPTION, PAGE_TITLE } from "@/lib/site";

export const metadata = pageMetadata({
  title: `${PAGE_TITLE} | ${BRAND}`,
  description: META_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  return <HomeView filters={emptyFilters()} member={false} />;
}
