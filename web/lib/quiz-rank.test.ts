import assert from "node:assert/strict";
import test from "node:test";
import {
  quizTitleKey,
  rankQuizMatches,
  type ScoredTightHit,
} from "./quiz-rank";

const RESUME = "Customer support specialist at a pharmacy counter from 2019 to 2025. Handled cash and trained cashiers in Toronto.";

function hit(partial: Partial<ScoredTightHit> & Pick<ScoredTightHit, "title" | "score">): ScoredTightHit {
  return {
    url: partial.url || `https://publicjobs.ca/jobs/example/${partial.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/`,
    employer: partial.employer || "University of Toronto",
    location: "Toronto",
    closing_date: partial.closing_date ?? "2026-12-20",
    reason: "Your counter experience fits this public service role well.",
    ...partial,
  };
}

test("shift copies of one title at one employer collapse to the highest score", () => {
  assert.equal(quizTitleKey("Athletic Facility Assistant (Sun - Thurs) Term"), "athletic facility assistant");
  assert.equal(quizTitleKey("Athletic Facility Assistant (Tues - Sat)"), quizTitleKey("Athletic Facility Assistant"));
  const ranked = rankQuizMatches(
    [
      hit({ title: "Athletic Facility Assistant (Sun - Thurs) Term", score: 4, closing_date: "2026-12-01" }),
      hit({ title: "Athletic Facility Assistant", score: 9, closing_date: "2026-12-28" }),
      hit({ title: "Athletic Facility Assistant (Tues - Sat)", score: 6, closing_date: "2026-12-02" }),
      hit({ title: "Junior Clerk", employer: "UHN", score: 8, closing_date: "2026-12-15" }),
    ],
    RESUME,
  );
  assert.deepEqual(ranked.map((row) => row.title), ["Athletic Facility Assistant", "Junior Clerk"]);
});

test("a higher score stays ahead of an earlier closing date", () => {
  const ranked = rankQuizMatches(
    [
      hit({ title: "Ward Clerk", employer: "UHN", score: 3, closing_date: "2026-12-01" }),
      hit({ title: "Client Representative", employer: "City of Toronto", score: 12, closing_date: "2027-03-01" }),
    ],
    RESUME,
  );
  assert.equal(ranked[0]?.title, "Client Representative");
  assert.equal(ranked[1]?.title, "Ward Clerk");
});

test("ties use field fit, then seniority, then the sooner closing date", () => {
  const byField = rankQuizMatches(
    [
      hit({ title: "Parks Labourer", employer: "City of Toronto", score: 5, closing_date: "2026-12-01" }),
      hit({ title: "Customer Support Clerk", employer: "TTC", score: 5, closing_date: "2026-12-20" }),
    ],
    RESUME,
  );
  assert.equal(byField[0]?.title, "Customer Support Clerk");

  const bySeniority = rankQuizMatches(
    [
      hit({ title: "Support Assistant", employer: "TTC", score: 5, closing_date: "2026-12-01" }),
      hit({ title: "Customer Advisor", employer: "City of Toronto", score: 5, closing_date: "2026-12-28" }),
    ],
    RESUME,
  );
  assert.equal(bySeniority[0]?.title, "Customer Advisor");

  const byDate = rankQuizMatches(
    [
      hit({ title: "Clinic Cash Clerk", employer: "UHN", score: 5, closing_date: "2026-12-20" }),
      hit({ title: "Toronto Cash Clerk", employer: "Sinai Health", score: 5, closing_date: "2026-12-03" }),
    ],
    RESUME,
  );
  assert.equal(byDate[0]?.title, "Toronto Cash Clerk");
});

test("one employer stops at three while another close employer is still waiting", () => {
  const same = [10, 9.8, 9.6, 9.4, 9.2].map((score, index) =>
    hit({ title: `Clerk ${index + 1}`, employer: "UHN", score, closing_date: `2026-12-${10 + index}` }),
  );
  const others = [
    hit({ title: "Customer Service Rep", employer: "TTC", score: 9.1, closing_date: "2026-12-25" }),
    hit({ title: "Client Services Clerk", employer: "City of Toronto", score: 8.9, closing_date: "2026-12-26" }),
  ];
  const ranked = rankQuizMatches([...same, ...others], RESUME);
  assert.equal(ranked.filter((row) => row.employer === "UHN").length, 3);
  assert.equal(ranked.filter((row) => row.employer === "TTC").length, 1);
  assert.equal(ranked.filter((row) => row.employer === "City of Toronto").length, 1);
  assert.deepEqual(
    ranked.map((row) => row.score),
    [...ranked].sort((a, b) => b.score - a.score).map((row) => row.score),
  );
});

test("one employer can fill the list when nothing else is close", () => {
  const same = [10, 9.5, 9, 8.5, 8].map((score, index) =>
    hit({ title: `Nurse ${index + 1}`, employer: "Unity Health", score }),
  );
  const far = hit({ title: "File Clerk", employer: "City of Toronto", score: 2 });
  const ranked = rankQuizMatches([...same, far], RESUME);
  assert.equal(ranked.length, 5);
  assert.equal(ranked.every((row) => row.employer === "Unity Health"), true);
});
