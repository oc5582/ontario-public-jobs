export type ListJob = {
  title: string;
  employer: string;
  location: string;
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
  employment_type: string;
  work_mode: string;
  salary: string;
  department: string;
  paragraphs: string[];
  apply_url: string;
  category: string;
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
  membership_status: "none" | "active" | "past_due" | "canceled";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  current_period_end: string | null;
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
