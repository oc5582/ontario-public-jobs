import { LegalTodo } from "@/components/LegalTodo";
import { readContent } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: `Privacy policy | ${BRAND}`,
  description:
    "PublicJobs.ca is an independent job board. This page explains what personal information we collect, why, and how you can control it.",
  path: "/privacy/",
});

export default function PrivacyPage() {
  const html = readContent("privacy-body.html");
  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Privacy policy</h1>
        <section className="description" dangerouslySetInnerHTML={{ __html: html }} />
        <LegalTodo page="privacy" />
      </article>
    </main>
  );
}
