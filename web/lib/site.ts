import { LEGAL } from "./legal-config";

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
    badge: null,
    perMonth: "$14.99",
    savings: null,
  },
  {
    id: "quarter",
    name: "3 months",
    price: "CA$29.99",
    amount: 29.99,
    contentName: "3months",
    period: "every 3 months",
    detail: "about CA$10 a month",
    badge: "Best for a job search",
    perMonth: "$10",
    savings: "save 33%",
  },
  {
    id: "year",
    name: "Year",
    price: "CA$59",
    amount: 59,
    contentName: "year",
    period: "per year",
    detail: "about CA$4.92 a month",
    badge: "Best value",
    perMonth: "$4.92",
    savings: "save 67%",
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

/** Pricing page order: 3 months, then monthly, then year. */
const PRICING_PLAN_ORDER = ["quarter", "month", "year"] as const satisfies readonly PlanId[];

export function pricingPlans() {
  return PRICING_PLAN_ORDER.map((id) => {
    const plan = PLANS.find((item) => item.id === id);
    if (!plan) throw new Error(`Missing plan ${id}`);
    return plan;
  });
}

export function pricingPlanFromQuery(value: string | null | undefined): PlanId {
  if (value === "month" || value === "quarter" || value === "year") return value;
  return "quarter";
}

/** Line under the big per-month price. Savings is null on the monthly plan. */
export function pricingBilled(id: PlanId): { text: string; savings: string | null } {
  const plan = PLANS.find((item) => item.id === id);
  if (!plan || plan.id === "month") {
    return { text: `${plan?.price ?? "CA$14.99"} billed every month`, savings: null };
  }
  if (plan.id === "quarter") {
    return { text: `${plan.price} every 3 months`, savings: plan.savings };
  }
  return { text: `${plan.price} once a year`, savings: plan.savings };
}

/** Renewal sentence under the main button. */
export function pricingRenewalNote(id: PlanId): string {
  const plan = PLANS.find((item) => item.id === id);
  if (!plan || id === "month") {
    return `Monthly, ${plan?.price ?? "CA$14.99"} plus GST/HST. Renews every month until you cancel.`;
  }
  if (id === "quarter") {
    return `3 months, ${plan.price} plus GST/HST. Renews every 3 months until you cancel.`;
  }
  return `Year, ${plan.price} plus GST/HST. Renews every year until you cancel. Reminder ${LEGAL.yearlyReminderDays} days before.`;
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
