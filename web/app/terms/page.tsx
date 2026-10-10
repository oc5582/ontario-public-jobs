import type { Metadata } from "next";
import { InfoArticle } from "@/components/ui";
import { readContent } from "@/lib/content";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms of use | PublicJobs.ca",
  description: "Terms of use for PublicJobs.ca, an independent job board for public employers in Toronto and the GTA.",
  path: "/terms/",
});

export default function TermsPage() {
  return <InfoArticle heading="Terms of use" html={readContent("terms.html")} current="terms" />;
}
