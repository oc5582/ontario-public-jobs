import assert from "node:assert/strict";
import { jobPostingJsonLd } from "../web/lib/jsonld.ts";
const base: any = { closed: false, posted: "2026-10-01", first_seen: "", closing: "2026-10-22", description: "", website: "https://trca.ca/", logo_url: "https://example.org/logo.png",
  jobposting: { "@context": "https://schema.org/", "@type": "JobPosting", title: "Custodian", description: "<p>x</p>", hiringOrganization: { "@type": "Organization", name: "TRCA", logo: "stale" } } };
const a: any = jobPostingJsonLd(base);
assert.equal(a.hiringOrganization.sameAs, "https://trca.ca/");
assert.equal(a.hiringOrganization.logo, "https://example.org/logo.png");
assert.equal(a.validThrough, "2026-10-22T23:59:59-04:00");
const b: any = jobPostingJsonLd({ ...base, logo_url: "" });
assert.equal("logo" in b.hiringOrganization, false);
console.log("jsonld.ts logo/sameAs ok");
