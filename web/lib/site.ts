export const BRAND = "PublicJobs.ca";
export const FREE_LIST_LIMIT = 10;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://publicjobs.ca").replace(/\/$/, "");
export const SIGNUP_ENDPOINT =
  process.env.NEXT_PUBLIC_SIGNUP_ENDPOINT ||
  "https://ontario-public-jobs-signup.publicjobs.workers.dev";
export const MATCH_ENDPOINT =
  process.env.NEXT_PUBLIC_MATCH_ENDPOINT ||
  "https://publicjobs-resume-match.publicjobs.workers.dev/match";

export const PAGE_TITLE = "Independent job board for government jobs in Toronto and the GTA";
export const META_DESCRIPTION =
  "City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and more than 60 other public employers in Toronto and the GTA, each hiring on its own website. Their openings, collected in one place.";
export const H1 = PAGE_TITLE;
export const SUBHEAD =
  "City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and more than 60 other public employers in Toronto and the GTA.";
export const FOOTER = "PublicJobs.ca is independent and not affiliated with any government.";

export const PLANS = [
  { id: "month", name: "Monthly", price: "CA$14.99", period: "per month", detail: "CA$14.99 a month" },
  { id: "quarter", name: "3 months", price: "CA$29.99", period: "every 3 months", detail: "CA$10.00 a month" },
  { id: "year", name: "Year", price: "CA$59", period: "per year", detail: "CA$4.92 a month" },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export const CATEGORY_LABELS: Record<string, string> = {
  "information-technology": "Information technology",
  finance: "Finance",
  "engineering-trades": "Engineering and trades",
  "health-and-social": "Health and social",
  administration: "Administration",
  "planning-and-policy": "Planning and policy",
  communications: "Communications",
  operations: "Operations",
  student: "Student and internship",
  other: "Other",
};

export const TYPE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  student: "Student",
  casual: "Casual",
  volunteer: "Volunteer",
  unspecified: "Not stated",
};
