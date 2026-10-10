import type { Metadata } from "next";
import { InfoArticle } from "@/components/ui";
import { readContent } from "@/lib/content";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Privacy policy | PublicJobs.ca",
  description:
    "PublicJobs.ca is an independent job board. This page explains what personal information we collect, why, and how you can control it.",
  path: "/privacy/",
});

export default function PrivacyPage() {
  return <InfoArticle heading="Privacy policy" html={readContent("privacy.html")} current="privacy" />;
}
