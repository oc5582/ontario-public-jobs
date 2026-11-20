import assert from "node:assert/strict";
import test from "node:test";
import { brokenGuideLinks, dataReportBySlug, readReportMarkdown, reportFaq } from "./data-reports";
import { parseReportMarkdown } from "./report-markdown";

const report = dataReportBySlug("ontario-public-jobs-november-2026");
if (!report) throw new Error("missing November 2026 report");

test("FAQ guide links match published guide slugs", () => {
  const faq = reportFaq(report);
  assert.ok(faq.length >= 16);
  assert.deepEqual(brokenGuideLinks(faq), []);
  const linked = faq.flatMap((item) => item.answer.match(/\/guides\/[a-z0-9-]+\//g) || []);
  assert.ok(linked.includes("/guides/how-city-of-toronto-hiring-works/"));
  assert.ok(linked.includes("/guides/how-to-become-a-go-bus-driver/"));
  assert.ok(linked.includes("/guides/how-csis-hiring-works/"));
  assert.ok(linked.includes("/guides/how-to-get-a-job-at-the-city-of-burlington/"));
});

test("questions render before methodology and tables keep the report figures", () => {
  const faq = reportFaq(report);
  const blocks = parseReportMarkdown(readReportMarkdown(report), { hasFaq: faq.length > 0 });
  const faqAt = blocks.findIndex((block) => block.type === "faq");
  const methodAt = blocks.findIndex(
    (block) => block.type === "heading" && block.text.startsWith("Methodology"),
  );
  assert.ok(faqAt >= 0);
  assert.ok(methodAt > faqAt);
  const faqBlock = blocks[faqAt];
  assert.equal(faqBlock.type, "faq");
  if (faqBlock.type === "faq") {
    assert.match(faqBlock.lead, /using only the figures in this snapshot/);
  }
  const sector = blocks.find((block) => block.type === "table" && block.headers[0] === "sector");
  assert.ok(sector && sector.type === "table");
  if (sector?.type === "table") assert.equal(sector.rows[0][1], "2,079");
  const text = JSON.stringify(blocks);
  assert.equal(text.includes("TO BE CONFIRMED"), false);
  assert.equal(text.includes("pending"), false);
});
