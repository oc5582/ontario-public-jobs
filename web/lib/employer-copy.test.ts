import assert from "node:assert/strict";
import test from "node:test";
import { buildEmployerSeo, employerProfile, medianDaysOpen, payLine, wordCount, type PaySample } from "./employer-copy";
import { sitemapLastmod, STATIC_LASTMOD } from "./sitemap-dates";

const TODAY = "2026-11-19";

function sample(partial: Partial<PaySample>): PaySample {
  return {
    posted: "2026-11-01",
    closing: "2026-11-15",
    salaryMin: null,
    salaryMax: null,
    salaryUnit: "YEAR",
    ...partial,
  };
}

test("sitemap lastmod keeps real past dates and drops future or blank ones", () => {
  assert.equal(sitemapLastmod("2026-11-18", TODAY), "2026-11-18");
  assert.equal(sitemapLastmod("2026-11-19T15:00:00Z", TODAY), "2026-11-19");
  assert.equal(sitemapLastmod("2026-12-11", TODAY), "");
  assert.equal(sitemapLastmod("", TODAY), "");
  assert.equal(sitemapLastmod("not-a-date", TODAY), "");
  for (const date of Object.values(STATIC_LASTMOD)) {
    assert.equal(sitemapLastmod(date, TODAY), date);
  }
});

test("hourly pay is annualized and rounded, and thin samples are omitted", () => {
  assert.equal(payLine([sample({ salaryMin: 40, salaryMax: 50, salaryUnit: "HOUR" })], "City of Toronto"), null);
  const line = payLine(
    [
      sample({ salaryMin: 25, salaryMax: 30, salaryUnit: "HOUR" }),
      sample({ salaryMin: 70000, salaryMax: 90000, salaryUnit: "YEAR" }),
      sample({ salaryMin: 52000, salaryMax: 52000, salaryUnit: "YEAR" }),
    ],
    "City of Toronto",
  );
  assert.ok(line);
  // 25 * 1950 = 48,750 → $49,000. 90,000 stays $90,000.
  assert.match(line.sentence, /from about \$49,000 to \$90,000 a year/);
  assert.match(line.sentence, /typical posting around \$/);
});

test("days open uses posted and closing dates and needs three jobs", () => {
  assert.equal(
    medianDaysOpen([
      sample({ posted: "2026-11-01", closing: "2026-11-11" }),
      sample({ posted: "2026-11-01", closing: "2026-11-21" }),
    ]),
    null,
  );
  assert.equal(
    medianDaysOpen([
      sample({ posted: "2026-11-01", closing: "2026-11-11" }),
      sample({ posted: "2026-11-01", closing: "2026-11-15" }),
      sample({ posted: "2026-11-01", closing: "2026-11-21" }),
      sample({ posted: "2026-12-01", closing: "2026-11-01" }),
      sample({ posted: "", closing: "2026-11-20" }),
    ]),
    14,
  );
});

test("strengthened employer pages use the live count, and the intro stays in range", () => {
  const toronto = employerProfile("city-of-toronto");
  const aurora = employerProfile("town-of-aurora");
  assert.ok(toronto && aurora);
  const pay = [
    sample({ salaryMin: 60000, salaryMax: 80000 }),
    sample({ salaryMin: 90000, salaryMax: 120000 }),
    sample({ salaryMin: 45000, salaryMax: 55000 }),
  ];
  const longTitles = [
    "Senior Transportation Planner for the Downtown Core and Waterfront",
    "Public Health Nurse for Communicable Disease Control and Outbreak Response",
    "Information Technology Project Manager for the Revenue Services Division",
  ];
  const torontoSeo = buildEmployerSeo(toronto, 87, longTitles, pay);
  assert.equal(torontoSeo.title, "City of Toronto Jobs – 87 Open Now | PublicJobs.ca");
  assert.equal(torontoSeo.h1, "City of Toronto jobs");
  assert.match(torontoSeo.description, /^See all 87 current City of Toronto job openings/);
  assert.equal(torontoSeo.paragraphs.length, 4);
  assert.match(torontoSeo.paragraphs[1], /the City of Toronto's careers site/);
  assert.match(torontoSeo.paragraphs[1], /there are 87 openings/);
  assert.match(torontoSeo.paragraphs[1], /Senior Transportation Planner/);
  assert.match(torontoSeo.paragraphs[2], /from about \$45,000 to \$120,000/);
  assert.match(torontoSeo.paragraphs[2], /median of 14 days/);
  assert.equal(
    torontoSeo.paragraphs[3],
    "You don't apply through PublicJobs.ca. Each listing links straight to the original posting on the City's own careers site (jobs.toronto.ca), where you submit your application. PublicJobs.ca is independent and not affiliated with the City of Toronto.",
  );
  assert.equal(
    torontoSeo.faqs.find((faq) => faq.question.startsWith("How do I apply"))?.answer,
    "Open the job on this page and follow the apply link. It takes you to the original posting on the City's own careers site (jobs.toronto.ca), where you submit your application. Applying is free.",
  );
  const torontoWords = wordCount(torontoSeo.paragraphs.join(" "));
  assert.ok(torontoWords >= 150 && torontoWords <= 300, `toronto intro is ${torontoWords} words`);
  assert.deepEqual(
    torontoSeo.faqs.map((faq) => faq.question),
    [
      "How many City of Toronto jobs are open right now?",
      "How much do City of Toronto jobs pay?",
      "How long do City of Toronto job postings stay open?",
      "How do I apply for a City of Toronto job?",
      "Is PublicJobs.ca part of the City of Toronto?",
      "Does the City of Toronto hire paramedics and nurses?",
    ],
  );

  const auroraSeo = buildEmployerSeo(aurora, 2, ["Facility Operator"], []);
  assert.equal(auroraSeo.title, "Town of Aurora Jobs – 2 Open Now | PublicJobs.ca");
  assert.equal(auroraSeo.h1, "Town of Aurora jobs");
  assert.equal(auroraSeo.paragraphs.length, 3);
  assert.match(auroraSeo.paragraphs[1], /the Town of Aurora's careers site/);
  assert.match(auroraSeo.paragraphs[1], /there are 2 openings/);
  assert.match(auroraSeo.paragraphs[1], /Recent postings include Facility Operator/);
  assert.equal(
    auroraSeo.paragraphs[2],
    "You don't apply through PublicJobs.ca. Each listing links straight to the original posting on the employer's ADP Workforce Now careers portal, where you submit your application. PublicJobs.ca is independent and not affiliated with the Town of Aurora.",
  );
  assert.equal(
    auroraSeo.faqs.find((faq) => faq.question.startsWith("How do I apply"))?.answer,
    "Open the job on this page and follow the apply link. It takes you to the original posting on the employer's ADP Workforce Now careers portal, where you submit your application. Applying is free.",
  );
  assert.equal(
    auroraSeo.faqs.some((faq) => faq.question.startsWith("How much")),
    false,
  );
  assert.equal(
    auroraSeo.faqs.some((faq) => faq.question.startsWith("How long")),
    false,
  );
  assert.match(auroraSeo.faqs.at(-1)?.answer || "", /not affiliated with the Town of Aurora/);
  const auroraWords = wordCount(auroraSeo.paragraphs.join(" "));
  assert.ok(auroraWords >= 150 && auroraWords <= 300, `aurora intro is ${auroraWords} words`);
});

test("one opening is singular", () => {
  const aurora = employerProfile("town-of-aurora");
  assert.ok(aurora);
  const seo = buildEmployerSeo(aurora, 1, ["Crossing Guard"], []);
  assert.match(seo.title, /1 Open Now/);
  assert.match(seo.description, /1 current Town of Aurora job opening /);
  assert.match(seo.paragraphs[1], /there is 1 opening/);
  assert.match(seo.faqs[0].answer, /There is 1 Town of Aurora job open right now/);
});
