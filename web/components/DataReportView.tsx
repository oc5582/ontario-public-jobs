import {
  DATA_LICENSE_NAME,
  DATA_LICENSE_URL,
  type DataReport,
  type FaqEntry,
  localPathFor,
} from "@/lib/data-reports";
import type { ReportBlock } from "@/lib/report-markdown";
import type { ReactNode } from "react";

const TEXT_COLUMN = /^(title|employer|sector|category|posted salary)$/i;

function numericColumn(header: string): boolean {
  if (TEXT_COLUMN.test(header.trim())) return false;
  return /(job|share|salary|employer|rank|median|%|annual|max)/i.test(header);
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|\/data\/[^\s)]+|\/guides\/[^\s)]+)/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    } else {
      const trimmed = token.replace(/[.,;:]+$/, "");
      const href = localPathFor(trimmed) || trimmed;
      const trailing = token.slice(trimmed.length);
      nodes.push(
        <a key={index} href={href}>
          {trimmed}
        </a>,
      );
      if (trailing) nodes.push(trailing);
    }
    last = start + token.length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function citationNodes(citation: string, href: string): ReactNode {
  const url = citation.match(/https?:\/\/\S+/)?.[0];
  if (!url) return citation;
  const [before, after] = citation.split(url);
  return (
    <>
      {before}
      <a href={href}>{url}</a>
      {after}
    </>
  );
}

function Downloads({ report }: { report: DataReport }) {
  const files = [
    { href: report.jsonPath, label: "JSON (all tables)" },
    { href: report.xlsxPath, label: "Excel workbook" },
    { href: report.markdownPath, label: "Markdown" },
    ...report.csv.map((file) => ({ href: file.href, label: `${file.label} (CSV)` })),
  ];
  return (
    <>
      <h2 id="downloads">Downloads</h2>
      <ul>
        {files.map((file) => (
          <li key={file.href}>
            <a href={file.href}>{file.label}</a>
          </li>
        ))}
      </ul>
    </>
  );
}

function Faq({ lead, items }: { lead: string; items: FaqEntry[] }) {
  return (
    <section aria-labelledby="questions-and-answers">
      <h2 id="questions-and-answers">Questions and answers</h2>
      {lead ? <p>{inline(lead)}</p> : null}
      {items.map((item) => (
        <div key={item.question}>
          <h3>{item.question}</h3>
          {item.answer.split(/\n\n+/).map((paragraph) => (
            <p key={paragraph}>{inline(paragraph)}</p>
          ))}
        </div>
      ))}
    </section>
  );
}

function Block({ block, report, faq }: { block: ReportBlock; report: DataReport; faq: FaqEntry[] }) {
  if (block.type === "heading") {
    if (block.level === 3) return <h3 id={block.id}>{block.text}</h3>;
    return <h2 id={block.id}>{block.text}</h2>;
  }
  if (block.type === "paragraph") return <p>{inline(block.text)}</p>;
  if (block.type === "list") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{inline(item)}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "downloads") return <Downloads report={report} />;
  if (block.type === "faq") return <Faq lead={block.lead} items={faq} />;
  const numeric = block.headers.map(numericColumn);
  return (
    <div className="stats-table-wrap">
      <table
        className={block.headers.length >= 5 ? "stats-table stats-table-wide" : "stats-table"}
        aria-labelledby={block.captionId || undefined}
      >
        <thead>
          <tr>
            {block.headers.map((header, index) => (
              <th key={header} scope="col" className={numeric[index] ? "num" : undefined}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")}>
              {block.headers.map((header, index) => (
                <td key={header} className={numeric[index] ? "num" : undefined}>
                  {row[index] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DataReportView({
  report,
  blocks,
  faq,
}: {
  report: DataReport;
  blocks: ReportBlock[];
  faq: FaqEntry[];
}) {
  const reportPath = `/data/${report.slug}/`;
  return (
    <article className="job-page content">
      <p className="crumb">
        <a href="/">All openings</a>
        {" / "}
        <a href="/data/">Data</a>
      </p>
      <h1>{report.title}</h1>
      <p className="employer">
        {"Source: "}
        <a href="/">PublicJobs.ca</a>
        {`, data as of ${report.sourceAsOf}`}
      </p>
      <p className="data-citation">Suggested citation: {citationNodes(report.citation, reportPath)}</p>
      <ul className="data-stats">
        {report.highlights.map((item) => (
          <li key={item.label} className="data-stat">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      <nav className="data-downloads" aria-label="Downloads">
        <a href={report.jsonPath}>JSON</a>
        <a href={report.xlsxPath}>Excel</a>
        <a href={report.markdownPath}>Markdown</a>
        <a href="#downloads">CSV tables</a>
      </nav>
      <section className="description stats-block data-report">
        {blocks.map((block, index) => (
          <Block key={block.type === "heading" ? block.id : `${block.type}-${index}`} block={block} report={report} faq={faq} />
        ))}
        <p className="data-license">
          License: <a href={DATA_LICENSE_URL}>{DATA_LICENSE_NAME}</a>
        </p>
      </section>
    </article>
  );
}
