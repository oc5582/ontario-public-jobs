import { CATEGORY_LABELS, TYPE_LABELS } from "@/lib/site";
import type { JobFilters } from "@/lib/filters";
import type { Facets } from "@/lib/types";

export function FilterBar({
  action,
  filters,
  facets,
  lockEmployer,
}: {
  action: string;
  filters: JobFilters;
  facets: Facets;
  lockEmployer?: boolean;
}) {
  return (
    <form className="filter-bar" method="get" action={action}>
      <div className="filter-field">
        <label htmlFor="f-q">Search</label>
        <input id="f-q" name="q" type="search" defaultValue={filters.q} autoComplete="off" />
      </div>
      <div className="filter-field">
        <label htmlFor="f-location">Location</label>
        <select className="filter-input" id="f-location" name="location" defaultValue={filters.location}>
          <option value="">Any</option>
          {facets.locations.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      {lockEmployer ? null : (
        <div className="filter-field">
          <label htmlFor="f-employer">Employer</label>
          <select className="filter-input" id="f-employer" name="employer" defaultValue={filters.employer}>
            <option value="">Any</option>
            {facets.employers.map((employer) => (
              <option key={employer.slug} value={employer.slug}>
                {employer.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="filter-field">
        <label htmlFor="f-category">Category</label>
        <select className="filter-input" id="f-category" name="category" defaultValue={filters.category}>
          <option value="">Any</option>
          {facets.categories.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category] || category}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor="f-type">Job type</label>
        <select className="filter-input" id="f-type" name="type" defaultValue={filters.type}>
          <option value="">Any</option>
          {facets.types.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type] || type}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor="f-salary-min">Salary from ($/year)</label>
        <input
          id="f-salary-min"
          name="salary_min"
          type="number"
          min={0}
          step={1000}
          defaultValue={filters.salaryMin ?? ""}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="f-salary-max">Salary to ($/year)</label>
        <input
          id="f-salary-max"
          name="salary_max"
          type="number"
          min={0}
          step={1000}
          defaultValue={filters.salaryMax ?? ""}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="f-posted">Posted since</label>
        <input id="f-posted" name="posted_since" type="date" defaultValue={filters.postedSince} />
      </div>
      <div className="filter-field">
        <label htmlFor="f-closes">Closes by</label>
        <input id="f-closes" name="closes_by" type="date" defaultValue={filters.closesBy} />
      </div>
      <div className="filter-actions">
        <button className="apply-btn" type="submit">
          Apply filters
        </button>
        <a href={action}>Clear</a>
      </div>
    </form>
  );
}
