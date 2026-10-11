export type ListJob = {
  title: string;
  employer: string;
  location: string;
  /** Parsed places from jobs.location_places. Absent on older callers. */
  location_places?: unknown;
  closing: string;
  type: string;
  href: string;
  path: string;
};

export type JobDetail = ListJob & {
  id: string;
  employer_slug: string;
  job_slug: string;
  page_title: string;
  meta_description: string;
  posted: string;
  first_seen: string;
  fetched: string;
  employment_type: string;
  work_mode: string;
  salary: string;
  department: string;
  description: string;
  paragraphs: string[];
  apply_url: string;
  category: string;
  cities: string[];
  closed: boolean;
  removed: boolean;
  website: string;
  logo_url: string;
  jobposting: Record<string, unknown> | null;
  fully_remote: boolean;
};

export type Profile = {
  id: string;
  email: string;
  membership_status: "none" | "active" | "past_due" | "canceled" | "refunded";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
};

export type Viewer = {
  email: string | null;
  profile: Profile | null;
  isMember: boolean;
};

export type Facets = {
  locations: string[];
  employers: { slug: string; name: string }[];
  categories: string[];
  types: string[];
};
