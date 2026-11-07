import { JsonLd } from "@/components/JsonLd";
import {
  LEGIT_DESCRIPTION,
  LEGIT_H1,
  LEGIT_PATH,
  LEGIT_PUBLISHED,
  LEGIT_TITLE,
  LEGIT_UPDATED_LABEL,
  legitJsonLd,
  legitSections,
  openingCountSentence,
  type InlinePart,
} from "@/lib/legit";
import { LEGAL } from "@/lib/legal-config";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import { publicJobStats } from "@/lib/stats-data";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: LEGIT_TITLE,
  description: LEGIT_DESCRIPTION,
  path: LEGIT_PATH,
  type: "article",
});

function Inline({ parts }: { parts: InlinePart[] }) {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      <span key={index}>{part}</span>
    ) : (
      <a key={index} href={part.href}>
        {part.text}
      </a>
    ),
  );
}

export default async function IsPublicJobsLegitPage() {
  let counts: { openJobs: number; employerCount: number } | null = null;
  try {
    const stats = await publicJobStats();
    counts = { openJobs: stats.openJobs, employerCount: stats.employerCount };
  } catch {
    counts = null;
  }
  const sections = legitSections();
  return (
    <main>
      <JsonLd data={legitJsonLd()} />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>{LEGIT_H1}</h1>
        <p className="employer">
          By <a href="/about/">{LEGAL.legalName}</a>, Founder, {BRAND}. Updated{" "}
          <time dateTime={LEGIT_PUBLISHED}>{LEGIT_UPDATED_LABEL}</time>.
        </p>
        <section className="description guide-body">
          {sections.map((section) => (
            <div key={section.id} id={section.id}>
              <h2 id={`${section.id}-h`}>{section.heading}</h2>
              {section.before.map((paragraph, index) => (
                <p key={`${section.id}-b-${index}`}>
                  <Inline parts={paragraph} />
                </p>
              ))}
              {section.id === "short-answer" ? <p>{openingCountSentence(counts)}</p> : null}
              {section.list ? (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.quotes?.map((quote) => (
                <blockquote key={quote.cite}>
                  <p>“{quote.text}”</p>
                  <cite>{quote.cite}</cite>
                </blockquote>
              ))}
              {section.note ? <p>{section.note}</p> : null}
              {section.after?.map((paragraph, index) => (
                <p key={`${section.id}-a-${index}`}>
                  <Inline parts={paragraph} />
                </p>
              ))}
            </div>
          ))}
        </section>
      </article>
    </main>
  );
}
