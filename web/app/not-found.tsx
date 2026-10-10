import { SiteFooter, SiteHeader } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main>
        <div className="content not-found">
          <h1>Page not found</h1>
          <p>This page may have moved, or the job may have closed.</p>
          <form className="search-field" role="search" action="/" method="get">
            <label htmlFor="job-search">Search titles and employers</label>
            <input id="job-search" name="q" type="search" autoComplete="off" spellCheck={false} />
            <button type="submit">Search</button>
          </form>
          <p>
            <a href="/">See all current jobs</a>
          </p>
          <p>
            <a href="/employers/">Employers</a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
