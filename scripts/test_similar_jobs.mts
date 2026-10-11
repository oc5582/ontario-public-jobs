import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageMetadata } from "../web/lib/seo.ts";
import { selectSimilarJobs, similarJobTier, type SimilarJobCandidate, type SimilarJobSource } from "../web/lib/similar-jobs.ts";
import { SITE_URL } from "../web/lib/site.ts";

const source: SimilarJobSource = {
  id: "current",
  category: "administration",
  employerSlug: "city-of-toronto",
  cities: ["Toronto"],
};

function candidate(
  partial: Partial<SimilarJobCandidate> & Pick<SimilarJobCandidate, "id" | "title">,
): SimilarJobCandidate {
  return {
    employer: "City of Toronto",
    employerSlug: "city-of-toronto",
    category: "administration",
    cities: ["Toronto"],
    location: "Toronto",
    closing: "2026-12-01",
    type: "Full-time",
    path: `jobs/city-of-toronto/${partial.id}`,
    ...partial,
  };
}

const titles = (jobs: { title: string }[]) => jobs.map((job) => job.title);

const ranked = selectSimilarJobs(source, [
  candidate({ id: "current", title: "This posting", path: "jobs/city-of-toronto/current" }),
  candidate({ id: "city-late", title: "Zebra clerk", cities: ["Toronto"] }),
  candidate({ id: "city-early", title: "Alpha clerk", cities: ["Toronto", "North York"] }),
  candidate({ id: "category-only", title: "Middle analyst", cities: ["Mississauga"], employer: "City of Mississauga", employerSlug: "city-of-mississauga" }),
  candidate({ id: "employer-only", title: "Beta driver", category: "engineering-trades", cities: ["Toronto"] }),
  candidate({ id: "closed", title: "Aaa closed", closed: true }),
  candidate({ id: "removed", title: "Aaa removed", removed: true }),
  candidate({ id: "unrelated", title: "Aaa elsewhere", category: "finance", employer: "Metrolinx", employerSlug: "metrolinx", cities: ["Toronto"] }),
]);

assert.deepEqual(titles(ranked), ["Alpha clerk", "Zebra clerk", "Middle analyst", "Beta driver"]);
assert.deepEqual(
  ranked.map((job) => job.href),
  [
    "/jobs/city-of-toronto/city-early/",
    "/jobs/city-of-toronto/city-late/",
    "/jobs/city-of-toronto/category-only/",
    "/jobs/city-of-toronto/employer-only/",
  ],
);
assert.equal(ranked[0].employer, "City of Toronto");
assert.equal(ranked[2].employer, "City of Mississauga");
assert.equal("salary" in ranked[0], false);

assert.equal(similarJobTier(source, candidate({ id: "city", title: "A", cities: ["Toronto"] })), 3);
assert.equal(similarJobTier(source, candidate({ id: "cat", title: "A", cities: ["Ottawa"] })), 2);
assert.equal(similarJobTier(source, candidate({ id: "emp", title: "A", category: "finance", cities: ["Toronto"] })), 1);
assert.equal(similarJobTier(source, candidate({ id: "no", title: "A", category: "finance", employerSlug: "metrolinx", cities: ["Toronto"] })), 0);
assert.equal(similarJobTier(source, candidate({ id: "current", title: "A" })), 0);
assert.equal(similarJobTier(source, candidate({ id: "closed", title: "A", closed: true })), 0);
assert.equal(similarJobTier(source, candidate({ id: "removed", title: "A", removed: true })), 0);

const blankCategory: SimilarJobSource = { ...source, category: "" };
assert.equal(similarJobTier(blankCategory, candidate({ id: "blank", title: "A", category: "" })), 1);
assert.equal(
  similarJobTier(blankCategory, candidate({ id: "other-blank", title: "A", category: "", employerSlug: "metrolinx" })),
  0,
);

const noCity: SimilarJobSource = { ...source, cities: [] };
assert.equal(similarJobTier(noCity, candidate({ id: "also-empty", title: "A", cities: [] })), 2);
assert.equal(similarJobTier(noCity, candidate({ id: "has-city", title: "A", cities: ["Toronto"] })), 2);

const sameTitle = selectSimilarJobs(source, [
  candidate({ id: "b", title: "Clerk", path: "jobs/city-of-toronto/b" }),
  candidate({ id: "a", title: "Clerk", path: "jobs/city-of-toronto/a" }),
  candidate({ id: "upper", title: "clerk", path: "jobs/city-of-toronto/upper" }),
]);
assert.deepEqual(
  sameTitle.map((job) => job.path),
  ["jobs/city-of-toronto/a/", "jobs/city-of-toronto/b/", "jobs/city-of-toronto/upper/"],
);

const many = selectSimilarJobs(
  source,
  ["F", "E", "D", "C", "B", "A"].map((title) => candidate({ id: title, title: `${title} role` })),
);
assert.deepEqual(titles(many), ["A role", "B role", "C role", "D role", "E role"]);
assert.equal(selectSimilarJobs(source, [candidate({ id: "only", title: "Only" })], 0).length, 0);

const pool = [
  candidate({ id: "1", title: "One" }),
  candidate({ id: "dup", title: "First copy" }),
  candidate({ id: "dup", title: "Second copy", category: "finance" }),
];
assert.deepEqual(titles(selectSimilarJobs(source, pool)), ["First copy", "One"]);

assert.deepEqual(
  selectSimilarJobs(source, [
    candidate({ id: "z", title: "Z" }),
    candidate({ id: "a", title: "A" }),
  ]),
  selectSimilarJobs(source, [
    candidate({ id: "a", title: "A" }),
    candidate({ id: "z", title: "Z" }),
  ]),
);

const employerView = readFileSync(new URL("../web/components/views/EmployerView.tsx", import.meta.url), "utf8");
assert.match(employerView, /UnlockCard/);
assert.doesNotMatch(employerView, /All open jobs at/);
assert.doesNotMatch(employerView, /employerOpenJobLinks/);

const jobView = readFileSync(new URL("../web/components/views/JobView.tsx", import.meta.url), "utf8");
assert.match(jobView, /Similar jobs/);
assert.match(jobView, /await similarOpenJobs\(job\)/);
assert.match(jobView, /jobPostingJsonLd\(job\)/);

const filtered = pageMetadata({
  title: "City of Toronto jobs | PublicJobs.ca",
  description: "Filtered employer list",
  path: "/employers/city-of-toronto/",
  index: false,
});
assert.equal(filtered.alternates?.canonical, `${SITE_URL}/employers/city-of-toronto/`);
assert.deepEqual(filtered.robots, { index: false, follow: true });

const clean = pageMetadata({
  title: "City of Toronto jobs | PublicJobs.ca",
  description: "Employer list",
  path: "/employers/city-of-toronto/",
});
assert.equal(clean.alternates?.canonical, `${SITE_URL}/employers/city-of-toronto/`);
assert.equal(clean.robots, undefined);

const employerPage = readFileSync(new URL("../web/app/dynamic/employers/[slug]/page.tsx", import.meta.url), "utf8");
assert.match(employerPage, /path: `\/employers\/\$\{slug\}\/`/);
assert.match(employerPage, /index: !filtering/);

const jobsSource = readFileSync(new URL("../web/lib/jobs.ts", import.meta.url), "utf8");
assert.match(jobsSource, /selectSimilarJobs\(/);
assert.match(jobsSource, /neighbourJobs/);
assert.doesNotMatch(jobsSource, /employerOpenJobLinks/);
assert.match(jobsSource, /\$3 <> '' and j\.category = \$3/);
assert.match(jobsSource, /j\.employer_slug = \$2/);

console.log("similar jobs selection ok");
