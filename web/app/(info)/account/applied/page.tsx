import { redirect } from "next/navigation";
import { AppliedRemove } from "@/components/AppliedRemove";
import { appliedEntryHref } from "@/lib/application-key";
import { APPLIED_RETENTION_DAYS } from "@/lib/applied-retention";
import { lapsedApplications, listAppliedJobs } from "@/lib/applications";
import { getViewer } from "@/lib/auth";
import { displayLocation } from "@/lib/display-location";
import { closingLabel } from "@/lib/format";
import { formatTorontoTimestamp } from "@/lib/membership";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Jobs I applied to | PublicJobs.ca",
  description: "The jobs you marked as applied on PublicJobs.ca.",
  path: "/account/applied/",
  index: false,
});

export default async function AppliedJobsPage() {
  const viewer = await getViewer();
  if (!viewer.email || !viewer.profile) redirect("/login/?next=/account/applied/");
  const profile = viewer.profile;

  if (!viewer.isMember) {
    const { count: kept, deleteOn } = await lapsedApplications(profile.id);
    const noun = kept === 1 ? "job" : "jobs";
    const until = formatTorontoTimestamp(deleteOn);
    return (
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/account/">Account</a>
          </p>
          <h1>Jobs I applied to</h1>
          <section className="unlock" aria-label="Membership">
            <h2>Your applied list is part of a membership</h2>
            <p>
              {kept > 0
                ? `You marked ${kept.toLocaleString("en-CA")} ${noun} as applied. The list is kept for ${APPLIED_RETENTION_DAYS} days after a membership ends${until ? `, until ${until}` : ""}, then deleted. Become a member again before then and it shows here again.`
                : "Members can mark any job as applied and see every one here, even after the posting closes."}{" "}
              Apply stays free on every job page.
            </p>
            <p className="unlock-actions">
              <a className="apply-btn" href="/pricing/">
                See membership
              </a>
            </p>
          </section>
        </article>
      </main>
    );
  }

  const entries = await listAppliedJobs(profile.id);
  const count = entries.length;

  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/account/">Account</a>
        </p>
        <h1>Jobs I applied to</h1>
        <section className="description">
          {count === 0 ? (
            <p>
              Nothing here yet. On any job page, choose &quot;Mark as applied&quot; and the job is listed here.
            </p>
          ) : (
            <p>
              {count.toLocaleString("en-CA")} {count === 1 ? "job" : "jobs"}, newest first. Each entry keeps the
              details from the day you marked it, so it stays here after the posting closes.
            </p>
          )}
        </section>
        {count > 0 ? (
          <ul className="job-list applied-list">
            {entries.map((entry) => {
              const href = appliedEntryHref(entry.path, entry.pageExists);
              const location = displayLocation(entry.location, entry.location_places);
              const close = entry.closed ? { text: "", urgent: false } : closingLabel(entry.closing);
              const applied = formatTorontoTimestamp(entry.appliedAt);
              return (
                <li key={entry.path} id={`applied-${entry.path.replace(/[^a-z0-9-]/gi, "-")}`}>
                  <div className="job-row">
                    <span className="job-main">
                      {href ? (
                        <a className="job-title" href={href}>
                          {entry.title}
                        </a>
                      ) : (
                        <span className="job-title">{entry.title}</span>
                      )}
                      <span className="job-sub">
                        {entry.employer ? <span className="job-employer">{entry.employer}</span> : null}
                        {applied ? <span className="pill">Applied {applied}</span> : null}
                        {entry.closed ? <span className="pill">Posting closed</span> : null}
                      </span>
                    </span>
                    <span className="job-side">
                      {location ? <span className="job-location">{location}</span> : null}
                      {entry.salary ? <span className="job-location">{entry.salary}</span> : null}
                      {close.text ? (
                        <time className={close.urgent ? "job-closing is-urgent" : "job-closing"} dateTime={entry.closing}>
                          {close.text}
                        </time>
                      ) : null}
                      {!entry.closed && entry.applyUrl ? (
                        <a className="applied-link" href={entry.applyUrl} rel="noopener nofollow" target="_blank">
                          Employer posting
                        </a>
                      ) : null}
                      <AppliedRemove jobKey={entry.path} title={entry.title} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </article>
    </main>
  );
}
