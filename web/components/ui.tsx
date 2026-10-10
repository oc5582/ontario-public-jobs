import { JOB_TYPE_OPTIONS } from "@/lib/classify";
import { hiddenFilterFields, type SearchParams } from "@/lib/filters";
import type { Filters, Listing } from "@/lib/jobs";
import type { FilterChoices } from "@/lib/store";
import { formatDate, pillLabel } from "@/lib/text";
import { memberState } from "@/lib/member";

const MORE = [
  ["About", "/about/", "about"],
  ["FAQ", "/faq/", "faq"],
  ["Privacy", "/privacy/", "privacy"],
  ["Terms", "/terms/", "terms"],
  ["Pricing", "/pricing/", "pricing"],
] as const;

export async function SiteHeader({ current = "" }: { current?: string }) {
  const member = await memberState();
  const accountHref = member.member || member.email ? "/account/" : "/sign-in/";
  const accountLabel = member.member || member.email ? "Account" : "Sign in";
  const accountKey = member.member || member.email ? "account" : "sign-in";
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="site-name" href="/">
          PublicJobs.ca
        </a>
        <nav className="site-nav" aria-label="Site">
          <a href="/match/" aria-current={current === "match" ? "page" : undefined}>
            Match your resume
          </a>
          <a href="/employers/" aria-current={current === "employers" ? "page" : undefined}>
            Employers
          </a>
          <div className="nav-more">
            <button type="button" className="nav-more-btn" id="nav-more-btn" aria-expanded="false" aria-controls="nav-more-panel">
              More
            </button>
            <ul className="nav-more-panel" id="nav-more-panel" hidden>
              {MORE.map(([label, href, key]) => (
                <li key={key}>
                  <a href={href} aria-current={current === key ? "page" : undefined}>
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <a href={accountHref} aria-current={current === accountKey ? "page" : undefined}>
                  {accountLabel}
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ current = "" }: { current?: string }) {
  const links = [
    ["About", "/about/", "about"],
    ["Frequently asked questions", "/faq/", "faq"],
    ["Privacy", "/privacy/", "privacy"],
    ["Terms", "/terms/", "terms"],
  ] as const;
  return (
    <footer className="site-footer">
      <div className="content">
        <p>PublicJobs.ca is independent and not affiliated with any government.</p>
        <nav className="footer-nav" aria-label="Footer">
          {links.map(([label, href, key]) => (
            <a key={key} href={href} aria-current={current === key ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function JobList({ jobs }: { jobs: Listing[] }) {
  if (!jobs.length) return null;
  return (
    <ul className="job-list" id="job-list">
      {jobs.map((job) => {
        const type = pillLabel(job.employmentType);
        return (
          <li key={job.href}>
            <a className="job-row" href={job.href}>
              <span className="job-main">
                <span className="job-title">{job.title}</span>
                <span className="job-sub">
                  {job.employer ? <span className="job-employer">{job.employer}</span> : null}
                  {type ? <span className="pill">{type}</span> : null}
                </span>
              </span>
              <span className="job-side">
                {job.location ? <span className="job-location">{job.location}</span> : null}
                {job.closingDate ? (
                  <time className="job-closing" dateTime={job.closingDate}>
                    {formatDate(job.closingDate)}
                  </time>
                ) : null}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function UnlockCard({ total, shown }: { total: number; shown: number }) {
  if (total <= shown) return null;
  const label = total.toLocaleString("en-CA");
  return (
    <section className="signup signup-compact unlock-card" aria-labelledby="unlock-heading">
      <h2 id="unlock-heading">See all {label} jobs</h2>
      <p>
        You&apos;re viewing the {shown} newest {shown === 1 ? "opening" : "openings"}. A membership shows the full list, with
        these filters.
      </p>
      <p className="unlock-actions">
        <a className="apply-btn" href="/pricing/">
          See all {label} jobs
        </a>
        <a href="/sign-in/">Sign in</a>
      </p>
    </section>
  );
}

export function FilterBar({
  action,
  filters,
  choices,
  sp,
  includeSearch = false,
  showEmployer = true,
}: {
  action: string;
  filters: Filters;
  choices: FilterChoices;
  sp: SearchParams;
  includeSearch?: boolean;
  showEmployer?: boolean;
}) {
  const hidden = hiddenFilterFields(filters, sp, includeSearch ? ["q", "location", "employer", "category", "type", "salary", "posted", "closing"] : ["location", "category", "type", "salary", "posted", "closing", "employer"]);
  const queryActive = ["q", "location", "category", "type", "salary", "posted", "closing", ...(showEmployer ? ["employer"] : [])].some(
    (key) => {
      const value = sp[key];
      const raw = Array.isArray(value) ? value[0] : value;
      return Boolean(raw);
    },
  );
  return (
    <form className="filter-bar" method="get" action={action}>
      {hidden.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      {includeSearch ? (
        <div className="search-field">
          <label htmlFor="job-search">Search titles and employers</label>
          <input id="job-search" name="q" type="search" defaultValue={filters.q} autoComplete="off" spellCheck={false} />
        </div>
      ) : null}
      <label className="filter-field">
        <span>Location</span>
        <select name="location" defaultValue={filters.location}>
          <option value="">Any</option>
          {choices.locations.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      {showEmployer ? (
        <label className="filter-field">
          <span>Employer</span>
          <select name="employer" defaultValue={typeof sp.employer === "string" ? sp.employer : filters.employer}>
            <option value="">Any</option>
            {choices.employers.map((employer) => (
              <option key={employer.slug} value={employer.slug}>
                {employer.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="filter-field">
        <span>Category</span>
        <select name="category" defaultValue={filters.category}>
          <option value="">Any</option>
          {choices.categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>Job type</span>
        <select name="type" defaultValue={typeof sp.type === "string" ? sp.type : ""}>
          <option value="">Any</option>
          {JOB_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>Salary</span>
        <select name="salary" defaultValue={typeof sp.salary === "string" ? sp.salary : ""}>
          <option value="">Any</option>
          <option value="50000">$50,000+</option>
          <option value="70000">$70,000+</option>
          <option value="90000">$90,000+</option>
          <option value="120000">$120,000+</option>
        </select>
      </label>
      <label className="filter-field">
        <span>Posted</span>
        <select name="posted" defaultValue={typeof sp.posted === "string" ? sp.posted : ""}>
          <option value="">Any time</option>
          <option value="7">Past 7 days</option>
          <option value="30">Past 30 days</option>
          <option value="90">Past 90 days</option>
        </select>
      </label>
      <label className="filter-field">
        <span>Closing</span>
        <select name="closing" defaultValue={typeof sp.closing === "string" ? sp.closing : ""}>
          <option value="">Any date</option>
          <option value="7">Within 7 days</option>
          <option value="30">Within 30 days</option>
          <option value="later">After 30 days</option>
        </select>
      </label>
      <div className="filter-actions">
        <button className="apply-btn" type="submit">
          Apply filters
        </button>
        {queryActive ? <a href={action}>Clear</a> : null}
      </div>
    </form>
  );
}

export function HeroSearch({ sp, filters }: { sp: SearchParams; filters: Filters }) {
  const hidden = hiddenFilterFields(filters, sp, ["q"]);
  return (
    <form className="search-field" role="search" method="get" action="/">
      {hidden.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <label htmlFor="job-search">Search titles and employers</label>
      <input id="job-search" name="q" type="search" defaultValue={filters.q} autoComplete="off" spellCheck={false} aria-controls="job-list" />
    </form>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function InfoArticle({
  heading,
  html,
  current,
}: {
  heading: string;
  html: string;
  current: string;
}) {
  return (
    <>
      <SiteHeader current={current} />
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/">All openings</a>
          </p>
          <h1>{heading}</h1>
          <section className="description" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </main>
      <SiteFooter current={current} />
    </>
  );
}
