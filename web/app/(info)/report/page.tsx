import { submitFraudReport } from "@/app/report/actions";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";

export const metadata = pageMetadata({
  title: `Report a fake or suspicious job | ${BRAND}`,
  description: "Tell PublicJobs.ca about a job posting that looks fake or suspicious.",
  path: "/report/",
  index: false,
});

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const job = typeof params.job === "string" ? params.job : "";
  const notice = typeof params.notice === "string" ? params.notice : "";

  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Report a fake or suspicious job</h1>
        <section className="description">
          <p>
            Tell us the job link and what you noticed. We review reports within two business days. See the{" "}
            <a href="/fraud-policy/">written policy</a>.
          </p>
          {notice === "sent" ? (
            <p className="status ok" role="status">
              Report received. We will review it.
            </p>
          ) : null}
          {notice && notice !== "sent" ? (
            <p className="status err" role="alert">
              {notice}
            </p>
          ) : null}
          <form action={submitFraudReport} className="report-form">
            <label htmlFor="job">Job link or path</label>
            <input id="job" name="job" type="text" defaultValue={job} maxLength={300} />
            <label htmlFor="email">Your email, if you want a reply</label>
            <input id="email" name="email" type="email" autoComplete="email" maxLength={254} />
            <label htmlFor="details">What you noticed</label>
            <textarea id="details" name="details" required minLength={10} maxLength={4000} rows={6} />
            <button className="apply-btn" type="submit">
              Send report
            </button>
          </form>
        </section>
      </article>
    </main>
  );
}
