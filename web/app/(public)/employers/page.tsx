import { EmployersView } from "@/components/views/EmployersView";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";

export const metadata = pageMetadata({
  title: `Employers | ${BRAND}`,
  description:
    "The full list of public employers in Toronto and the GTA whose current job openings PublicJobs.ca collects. You apply on each employer's own website.",
  path: "/employers/",
});

export default function EmployersPage() {
  return <EmployersView />;
}
