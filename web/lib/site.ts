export const BRAND = "PublicJobs.ca";
export const FREE_LIST_LIMIT = 10;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://publicjobs.ca").replace(/\/$/, "");
export const SIGNUP_ENDPOINT =
  process.env.NEXT_PUBLIC_SIGNUP_ENDPOINT ||
  "https://ontario-public-jobs-signup.publicjobs.workers.dev";

export const PAGE_TITLE = "Government jobs in Toronto and the GTA";
export const META_DESCRIPTION =
  "Current openings at the City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and 50+ other GTA public employers, collected every weekday. Apply free on each employer's site.";
export const H1 = PAGE_TITLE;
export const SUBHEAD =
  "City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and more than 50 other public employers in Toronto and the GTA.";
export const FOOTER = "PublicJobs.ca is independent and not affiliated with any government.";

export const PLANS = [
  {
    id: "month",
    name: "Monthly",
    price: "CA$14.99",
    amount: 14.99,
    contentName: "monthly",
    period: "per month",
    detail: "CA$14.99 a month",
  },
  {
    id: "quarter",
    name: "3 months",
    price: "CA$29.99",
    amount: 29.99,
    contentName: "3months",
    period: "every 3 months",
    detail: "about CA$10 a month",
  },
  {
    id: "year",
    name: "Year",
    price: "CA$59",
    amount: 59,
    contentName: "year",
    period: "per year",
    detail: "about CA$4.92 a month",
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

/** Price before tax, shared by Stripe checkout and the Meta pixel. */
export function planPixel(id: string): { value: number; contentName: string } | null {
  const plan = PLANS.find((item) => item.id === id);
  if (!plan) return null;
  return { value: plan.amount, contentName: plan.contentName };
}

/** Price line shown on the site and stored with the agreement. */
export function planPriceLine(id: PlanId): string {
  const plan = PLANS.find((item) => item.id === id);
  if (!plan) return "";
  if (id === "quarter") return `${plan.price} every 3 months (${plan.detail})`;
  if (id === "year") return `${plan.price} a year (${plan.detail})`;
  return `${plan.price} a month`;
}

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
