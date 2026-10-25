import { closingLabel } from "@/lib/format";
import { formatTorontoTimestamp } from "@/lib/membership";
import { weeklyEmailConsentLabel, type TightHit } from "@/lib/weekly-match";
import type { SavedResumeRow, WeeklyResultRow } from "@/lib/weekly-match-data";

export function WeeklyMatchPanel({
  saved,
  optedIn,
  results,
  sample = false,
  ready = true,
  matchesHref = "/account/weekly/",
}: {
  saved: SavedResumeRow | null;
  optedIn: boolean;
  results: WeeklyResultRow | null;
  sample?: boolean;
  ready?: boolean;
  matchesHref?: string;
}) {
  const savedOn = saved ? formatTorontoTimestamp(saved.updatedAt) : "";
  const canEmail = Boolean(saved) && ready;

  return (
    <div className="account-weekly" id="weekly-matches" data-ready={ready ? "1" : "0"}>
      <div className="account-weekly-main">
        <h2>Weekly job matches</h2>
        <p>Every Saturday, we’ll email you the jobs that best fit your resume.</p>
        {results ? (
          <p className="weekly-list-link">
            <a href={matchesHref}>See this week’s matches →</a>
          </p>
        ) : null}
        {!ready ? (
          <p className="status" role="status">
            Weekly matches are not available right now.
          </p>
        ) : null}

        <div className="weekly-resume">
          <h3>Your resume</h3>
          <div id="weekly-saved-state" hidden={!saved}>
            <p className="weekly-saved-row">
              <span id="weekly-saved-label">{savedOn ? `✓ Saved ${savedOn}` : "✓ Saved"}</span>
              <span id="weekly-saved-flash" className="weekly-flash" role="status" hidden />
              <button type="button" className="weekly-text-btn" id="weekly-replace-btn">
                Replace
              </button>
              <button type="button" className="weekly-text-btn" id="weekly-remove-btn">
                Remove
              </button>
            </p>
            <p id="weekly-remove-confirm" className="weekly-saved-row" hidden>
              <span>Remove your saved resume?</span>
              <button type="button" className="weekly-text-btn" id="weekly-remove-yes">
                Remove
              </button>
              <button type="button" className="weekly-text-btn" id="weekly-remove-no">
                Cancel
              </button>
            </p>
          </div>

          <form id="weekly-resume-form" hidden={Boolean(saved)} data-sample={sample ? "1" : undefined}>
            <label htmlFor="weekly-resume-file">Upload your resume (PDF or Word)</label>
            <input
              type="file"
              id="weekly-resume-file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={!ready}
            />
            <p className="hint" id="weekly-file-status" aria-live="polite" hidden />
            <p className="hint">or paste the text below</p>
            <textarea
              id="weekly-resume-text"
              maxLength={15000}
              placeholder="Paste your work experience, education and skills"
              aria-label="Paste your work experience, education and skills"
              disabled={!ready}
            />
            <p className="login-actions">
              <button className="apply-btn" type="submit" id="weekly-save-btn" disabled={!ready}>
                Save resume
              </button>
              <button type="button" className="weekly-text-btn" id="weekly-replace-cancel" hidden>
                Cancel
              </button>
            </p>
            <div className="hp" aria-hidden="true">
              <label htmlFor="weekly-gotcha">Leave this field blank</label>
              <input type="text" id="weekly-gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
            </div>
          </form>
        </div>

        <form id="weekly-email-form" data-sample={sample ? "1" : undefined}>
          <label className="checkbox" htmlFor="weekly-opt-in">
            <input
              type="checkbox"
              id="weekly-opt-in"
              name="opted_in"
              value="yes"
              defaultChecked={optedIn && canEmail}
              disabled={!canEmail}
            />
            <span>
              {weeklyEmailConsentLabel()}
              <span id="weekly-email-flash" className="weekly-flash" role="status" hidden />
            </span>
          </label>
          <p className="hint" id="weekly-email-hint" hidden={Boolean(saved)}>
            Save a resume first.
          </p>
        </form>

        <div id="weekly-status" className="status" role="status" aria-live="polite" hidden />

        <p className="account-weekly-note">
          We only email you when there’s a strong match. We save your resume’s text, not the file, and delete it if you
          close your account. The Match page never saves your resume.
        </p>
      </div>
    </div>
  );
}

export function WeeklyResultsList({ results }: { results: WeeklyResultRow | null }) {
  const checkedOn = results ? results.weekLabel || formatTorontoTimestamp(results.ranAt) : "";
  if (!results) {
    return (
      <p>Nothing here yet. After you save a resume and turn on the email, the Saturday list shows up here.</p>
    );
  }
  if (results.jobs.length === 0) {
    return <p>No strong matches {checkedOn ? `on ${checkedOn}` : "last Saturday"}. We did not send an email.</p>;
  }
  return (
    <>
      <p>
        {results.jobs.length.toLocaleString("en-CA")} strong {results.jobs.length === 1 ? "match" : "matches"}
        {checkedOn ? ` from ${checkedOn}` : ""}. These are suggestions and can be wrong.
      </p>
      <ol className="results">
        {results.jobs.map((job) => (
          <WeeklyJob key={job.url} job={job} />
        ))}
      </ol>
    </>
  );
}

function WeeklyJob({ job }: { job: TightHit }) {
  const close = closingLabel(job.closing_date);
  const meta = [job.employer, job.location, close.text].filter(Boolean).join(" · ");
  return (
    <li>
      <a href={job.url}>{job.title}</a>
      {meta ? <p className="meta">{meta}</p> : null}
      {job.reason ? <p className="why">{job.reason}</p> : null}
    </li>
  );
}
