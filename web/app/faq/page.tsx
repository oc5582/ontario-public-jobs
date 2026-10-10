import type { Metadata } from "next";
import { InfoArticle } from "@/components/ui";
import { readContent } from "@/lib/content";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Government and Crown corporation jobs in Toronto: FAQ | PublicJobs.ca",
  description:
    "Answers about government jobs in Toronto: Crown corporations, Ontario provincial agencies, City of Toronto agencies, pensions, unions and who can apply.",
  path: "/faq/",
});

export default function FaqPage() {
  return <InfoArticle heading="Frequently asked questions" html={readContent("faq.html")} current="faq" />;
}
