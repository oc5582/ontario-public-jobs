import { closingLabel, pillLabel } from "@/lib/format";
import type { ListJob } from "@/lib/types";

export function JobList({ jobs, id }: { jobs: ListJob[]; id?: string }) {
  return (
    <ul className="job-list" id={id} tabIndex={id ? -1 : undefined}>
      {jobs.map((job) => {
        const close = closingLabel(job.closing);
        const type = pillLabel(job.type);
        return (
          <li key={job.href}>
            <a className="job-row" href={job.href}>
              <span className="job-main">
                <span className="job-title">{job.title}</span>
                {job.employer || type ? (
                  <span className="job-sub">
                    {job.employer ? <span className="job-employer">{job.employer}</span> : null}
                    {type ? <span className="pill">{type}</span> : null}
                  </span>
                ) : null}
              </span>
              {job.location || close.text ? (
                <span className="job-side">
                  {job.location ? <span className="job-location">{job.location}</span> : null}
                  {close.text ? (
                    <time className={close.urgent ? "job-closing is-urgent" : "job-closing"} dateTime={job.closing}>
                      {close.text}
                    </time>
                  ) : null}
                </span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
