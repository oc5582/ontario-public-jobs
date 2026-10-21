import { JsonLd } from "@/components/JsonLd";
import { publicJobStats } from "@/lib/stats-data";
import { datasetJsonLd, formatCount, STATS_LICENSE, STATS_NAME, type PublicJobStats } from "@/lib/stats";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";

export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  const stats = await publicJobStats();
  return pageMetadata({
    title: `${STATS_NAME} | ${BRAND}`,
    description: stats.facts.slice(0, 2).join(" "),
    path: "/stats/",
  });
}

function employerRows(stats: PublicJobStats) {
  return stats.employers.map((employer) => (
    <tr key={employer.slug}>
      <td>
        <a href={`/employers/${employer.slug}/`}>{employer.name}</a>
      </td>
      <td className="num">{formatCount(employer.openJobs)}</td>
      <td className="num">{employer.salaryPercent}%</td>
      <td className="num">{employer.salaryRange}</td>
      <td className="num">{formatCount(employer.closingIn7Days)}</td>
    </tr>
  ));
}

export default async function StatsPage() {
  const stats = await publicJobStats();
  return (
    <main>
      <link rel="stylesheet" href="/pages.css" />
      <JsonLd data={datasetJsonLd(stats)} />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>{STATS_NAME}</h1>
        <p className="employer">As of {stats.asOfLabel} (last refresh).</p>
        <section className="description">
          {stats.facts.map((fact) => (
            <p key={fact}>{fact}</p>
          ))}
          <p>
            <a href="/stats.json">JSON</a>
            {" and "}
            <a href="/stats.csv">CSV</a>
            {" of these counts."}
          </p>
          <p>
            Data license: <a href={STATS_LICENSE}>CC BY 4.0</a>. Free to reuse if you cite{" "}
            <a href={`${SITE_URL}/`}>{BRAND}</a>.
          </p>
        </section>
        <section className="description stats-block">
          <h2 id="by-employer">By employer</h2>
          <div className="stats-table-wrap">
            <table className="stats-table stats-table-wide" aria-labelledby="by-employer">
              <thead>
                <tr>
                  <th scope="col">Employer</th>
                  <th className="num" scope="col">
                    Open jobs
                  </th>
                  <th className="num" scope="col">
                    % posting salary
                  </th>
                  <th className="num" scope="col">
                    Salary range (posted min–max)
                  </th>
                  <th className="num" scope="col">
                    Closing in 7 days
                  </th>
                </tr>
              </thead>
              <tbody>{employerRows(stats)}</tbody>
            </table>
          </div>
          <h2 id="by-city">By city</h2>
          {stats.cities.length ? (
            <div className="stats-table-wrap">
              <table className="stats-table" aria-labelledby="by-city">
                <thead>
                  <tr>
                    <th scope="col">City</th>
                    <th className="num" scope="col">
                      Open jobs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.cities.map((city) => (
                    <tr key={city.city}>
                      <td>{city.city}</td>
                      <td className="num">{formatCount(city.openJobs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No open job lists a city.</p>
          )}
          <h2 id="by-salary">By salary band</h2>
          <div className="stats-table-wrap">
            <table className="stats-table" aria-labelledby="by-salary">
              <thead>
                <tr>
                  <th scope="col">Salary band</th>
                  <th className="num" scope="col">
                    Open jobs
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.salaryBands.map((band) => (
                  <tr key={band.id}>
                    <td>{band.label}</td>
                    <td className="num">{formatCount(band.openJobs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="description">
          <h2>How we count</h2>
          {stats.howWeCount.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      </article>
    </main>
  );
}
