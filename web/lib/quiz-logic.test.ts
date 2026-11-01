import assert from "node:assert/strict";
import test from "node:test";
import { annualAmount, areasFor, jobTypesForTitle, levelForTitle } from "./quiz-tag";
import { quizBroad, quizResults, type QuizJob } from "./quiz-logic";

test("hourly and weekly pay become yearly, and an already yearly figure stays put", () => {
  assert.equal(annualAmount(40, "HOUR"), 78000);
  assert.equal(annualAmount(1000, "WEEK"), 52000);
  assert.equal(annualAmount(78000, "HOUR"), 78000);
  assert.equal(annualAmount(85000, "YEAR"), 85000);
  assert.equal(annualAmount(null, "HOUR"), 0);
});

test("titles and places get the quiz tags", () => {
  assert.ok(jobTypesForTitle("Software Developer").includes("it"));
  assert.ok(jobTypesForTitle("Registered Nurse").includes("community"));
  assert.deepEqual(jobTypesForTitle("Business Analyst"), ["policy"]);
  assert.equal(levelForTitle("Director of Finance"), "mgr");
  assert.deepEqual(areasFor("100 Queen St W, Toronto", "Someone"), ["toronto"]);
  assert.deepEqual(areasFor("", "City of Mississauga"), ["peel"]);
  assert.deepEqual(areasFor("Remote", "Unknown Board"), ["other"]);
});

function job(partial: Partial<QuizJob> & Pick<QuizJob, "t" | "c" | "r">): QuizJob {
  return {
    e: 0,
    l: "mid",
    mn: 90000,
    mx: 110000,
    p: "year",
    po: "2026-10-20",
    cl: "2026-12-01",
    u: `/jobs/${partial.t}/`,
    ...partial,
  };
}

test("salary drops only a posted range under the minimum, and level never removes a job", () => {
  const open = [
    job({ t: "a", c: ["it"], r: ["toronto"], mx: 70000, mn: 60000 }),
    job({ t: "b", c: ["it"], r: ["toronto"], mx: 0, mn: 0, l: "entry" }),
    job({ t: "c", c: ["it"], r: ["toronto"], l: "mgr", mx: 120000 }),
  ];
  const found = quizResults(open, { work: ["it"], level: ["mid"], sal: "80", where: ["toronto"] }, "2026-11-01", "2026-10-02");
  assert.equal(found.below, 1);
  assert.equal(found.total, 2);
  assert.ok(found.all.some((item) => item.t === "b" && item._why === "Salary not posted"));
  assert.ok(found.all.some((item) => item.t === "c" && item._why === "Different level"));
});

test("the headline count pads with related roles until it passes 100", () => {
  const open: QuizJob[] = [];
  for (let i = 0; i < 40; i += 1) open.push(job({ t: `it-${i}`, c: ["it"], r: ["toronto"] }));
  for (let i = 0; i < 70; i += 1) open.push(job({ t: `office-${i}`, c: ["office"], r: ["toronto"] }));
  const answers = { work: ["it"], level: ["mid"], sal: "60", where: ["toronto"] };
  const found = quizResults(open, answers, "2026-11-01", "2026-10-02");
  const broad = quizBroad(open, answers, found, "2026-11-01", "2026-10-02");
  assert.equal(found.total, 40);
  assert.ok(broad.n >= 100);
  assert.match(broad.extra, /related roles in office and admin/);
  assert.ok(broad.list.slice(0, 5).every((item) => item.c.includes("it")));
  assert.ok(broad.list.some((item) => item._why === "Related role"));
});
