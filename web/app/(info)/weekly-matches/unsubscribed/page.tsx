import { LEGAL } from "@/lib/legal-config";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Weekly match emails | PublicJobs.ca",
  description: "Turn off the Saturday match email from PublicJobs.ca.",
  path: "/weekly-matches/unsubscribed/",
  index: false,
});

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const done = params.done === "1";
  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/account/">Account</a>
        </p>
        <h1>Weekly match emails</h1>
        <section className="description">
          {done ? (
            <p>Weekly match emails are off. Your membership is unchanged. You can turn the email on again from your account page.</p>
          ) : (
            <p>
              This unsubscribe link is not valid. You can turn weekly match emails off from your account page, or email{" "}
              {LEGAL.supportEmail}.
            </p>
          )}
          <p>
            <a className="apply-btn" href="/account/">
              Account
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
