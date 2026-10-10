import type { Metadata } from "next";
import { InfoArticle } from "@/components/ui";
import { readContent } from "@/lib/content";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "About | PublicJobs.ca",
  description:
    "PublicJobs.ca is an independent job board run by Osama Chaudhary. It lists current openings from public employers in Toronto and the GTA.",
  path: "/about/",
});

export default function AboutPage() {
  return <InfoArticle heading="About PublicJobs.ca" html={readContent("about.html")} current="about" />;
}
