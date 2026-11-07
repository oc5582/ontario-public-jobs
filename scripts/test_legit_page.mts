import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MEMBER_DAILY_LIMIT } from "../web/lib/match.ts";
import { FREE_LIST_LIMIT } from "../web/lib/site.ts";
import {
  LEGIT_DESCRIPTION,
  LEGIT_H1,
  LEGIT_PATH,
  LEGIT_PUBLISHED,
  LEGIT_TITLE,
  legitJsonLd,
  legitPriceLines,
  legitSections,
  openingCountSentence,
  sectionText,
} from "../web/lib/legit.ts";

const prices = legitPriceLines();
assert.equal(prices.month, "CA$14.99 every month");
assert.equal(prices.quarter, "CA$29.99 every 3 months (CA$9.99 a month)");
assert.equal(prices.year, "CA$59.00 every year (about CA$4.92 a month)");

assert.equal(FREE_LIST_LIMIT, 10);
assert.equal(MEMBER_DAILY_LIMIT, 20);

const fallback = openingCountSentence(null);
assert.match(fallback, /hundreds of current openings/);
assert.doesNotMatch(fallback, /\d/);
assert.equal(openingCountSentence({ openJobs: 0, employerCount: 10 }), fallback);
assert.equal(
  openingCountSentence({ openJobs: 50, employerCount: 10 }),
  "It lists 50 current openings from 10 public employers in Toronto and the GTA.",
);
assert.equal(
  openingCountSentence({ openJobs: 1, employerCount: 1 }),
  "It lists 1 current opening from 1 public employer in Toronto and the GTA.",
);
const live = openingCountSentence({ openJobs: 412, employerCount: 80 });
assert.match(live, /hundreds of current openings/);
assert.match(live, /412 current openings from 80 public employers/);
assert.doesNotMatch(live, /777/);

const sections = legitSections();
const plain = sections.map((section) => `${section.heading} ${sectionText(section)}`).join("\n");
assert.match(plain, /newest 10/);
assert.match(plain, /up to 20 resume matches a day/);
assert.match(plain, /712442870RT0001/);
assert.match(plain, /hello@publicjobs\.ca/);
assert.match(plain, /I like that new jobs show up every day/);
assert.match(plain, /Amira K\., early user/);
assert.match(plain, /Names changed for privacy/);
assert.match(plain, /within 5 days/);
assert.match(plain, /no free trial/);
assert.match(plain, /not a government website/);
assert.equal(
  sections.filter((section) => section.quotes).reduce((sum, section) => sum + (section.quotes?.length ?? 0), 0),
  2,
);

const forbidden = [
  /Thorncliffe/i,
  /603-65/,
  /M4H/,
  /647/,
  /917-3942/,
  /tel:/i,
  /telephone/i,
  /streetAddress/i,
  /postalCode/i,
  /Trustpilot/i,
  /subscribers/i,
  /\b777\b/,
];
const json = JSON.stringify(legitJsonLd());
for (const pattern of forbidden) {
  assert.doesNotMatch(plain, pattern);
  assert.doesNotMatch(json, pattern);
}

const data = legitJsonLd() as { "@graph": Array<Record<string, unknown>> };
const graph = data["@graph"];
const org = graph.find((node) => node["@type"] === "Organization");
const article = graph.find((node) => node["@type"] === "BlogPosting");
const faq = graph.find((node) => node["@type"] === "FAQPage");
assert.ok(org);
assert.equal(org.email, "hello@publicjobs.ca");
assert.equal(org.url, "https://publicjobs.ca/");
assert.equal("address" in org, false);
assert.equal("telephone" in org, false);
assert.equal((org.founder as { "@id": string })["@id"].endsWith("#osama-chaudhary"), true);
assert.ok(article);
assert.equal(article.headline, LEGIT_TITLE);
assert.equal(article.description, LEGIT_DESCRIPTION);
assert.equal(article.datePublished, LEGIT_PUBLISHED);
assert.equal(article.dateModified, LEGIT_PUBLISHED);
assert.equal(article.mainEntityOfPage, `https://publicjobs.ca${LEGIT_PATH}`);
assert.ok(faq);
const questions = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
assert.deepEqual(
  questions.map((item) => item.name),
  sections.filter((section) => section.faq).map((section) => section.heading),
);
assert.ok(questions.every((item) => item.acceptedAnswer.text.length > 40));

const page = readFileSync(new URL("../web/app/(info)/is-publicjobs-ca-legit/page.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../web/components/SiteFooter.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../web/components/SiteHeader.tsx", import.meta.url), "utf8");
const about = readFileSync(new URL("../web/content/about-body.html", import.meta.url), "utf8");
const faqHtml = readFileSync(new URL("../web/content/faq-body.html", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../web/app/sitemap.xml/route.ts", import.meta.url), "utf8");
for (const pattern of forbidden) {
  assert.doesNotMatch(page, pattern);
  assert.doesNotMatch(footer, pattern);
}
assert.equal(LEGIT_H1, "Is PublicJobs.ca legit?");
assert.equal(LEGIT_TITLE, "Is PublicJobs.ca Legit?");
assert.match(page, /\{LEGIT_H1\}/);
assert.match(footer, /link\("Is PublicJobs\.ca legit\?", "\/is-publicjobs-ca-legit\/", "\/is-publicjobs-ca-legit"\)/);
assert.match(header, /nav\("Is PublicJobs\.ca legit\?", "\/is-publicjobs-ca-legit\/", "legit"\)/);
assert.match(about, /href="\/is-publicjobs-ca-legit\/"/);
assert.match(faqHtml, /href="\/is-publicjobs-ca-legit\/"/);
assert.match(sitemap, /LEGIT_PATH/);
assert.doesNotMatch(about, /603-65 Thorncliffe Park Drive[\s\S]*is-publicjobs-ca-legit/);

console.log("legit page copy ok");
