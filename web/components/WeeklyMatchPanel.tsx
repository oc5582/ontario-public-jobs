import { closingLabel } from "@/lib/format";
import { alertConsentSender } from "@/lib/legal-copy";
import { formatTorontoTimestamp } from "@/lib/membership";
import {
  resumeSourceLabel,
  weeklyEmailConsentLabel,
  type TightHit,
} from "@/lib/weekly-match";
import type { SavedResumeRow, WeeklyResultRow } from "@/lib/weekly-match-data";

export function WeeklyMatchPanel({
  saved,
  optedIn,
  results,
  sample = false,
  ready = true,
}: {
  saved: SavedResumeRow | null;
  optedIn: boolean;
  results: WeeklyResultRow | null;
  sample?: boolean;
  ready?: boolean;
}) {
  const savedOn = saved ? formatTorontoTimestamp(saved.updatedAt) : "";
  const checkedOn = results ? results.weekLabel || formatTorontoTimestamp(results.ranAt) : "";
  const canEmail = Boolean(saved) && ready;

  return (
    <div className="account-weekly" id="weekly-matches">
      <h2>Weekly matches</h2>
      <p>
        Save one resume and, if you want, get an email on Saturday when a tighter list is ready. The list stays here
        and replaces last week. The Match page is separate and still does not store a resume.
      </p>
      {!ready ? (
        <p className="status" role="status">
          Weekly matches are not available right now.
        </p>
      ) : null}

      <form id="weekly-resume-form" data-sample={sample ? "1" : undefined}>
        <h3>Saved resume</h3>
        {saved ? (
          <p>
            Saved{savedOn ? ` ${savedOn}` : ""}. {saved.charCount.toLocaleString("en-CA")} characters
            {saved.source ? ` from ${resumeSourceLabel(saved.source).toLowerCase()}` : ""}. We keep the text, not the
            file. Only you can open it, and it is deleted with the account.
          </p>
        ) : (
          <p>No resume saved yet. Upload a PDF or Word file, or paste the text. The file stays on your device.</p>
        )}
        <label htmlFor="weekly-resume-file">Upload a PDF or Word file</label>
        <input
          type="file"
          id="weekly-resume-file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={!ready}
        />
        <p className="hint" id="weekly-file-status" aria-live="polite">
          Your file stays on your device. Only the text is saved on the account.
        </p>
        <p className="or">Or paste your resume text</p>
        <label htmlFor="weekly-resume-text">Resume text</label>
        <textarea
          id="weekly-resume-text"
          maxLength={15000}
          placeholder="Paste your work experience, education and skills"
          disabled={!ready}
        />
        <p className="login-actions">
          <button className="apply-btn" type="submit" id="weekly-save-btn" disabled={!ready}>
            Save resume
          </button>
          {saved ? (
            <button className="apply-btn secondary" type="button" id="weekly-remove-btn">
              Remove resume
            </button>
          ) : null}
        </p>
        <div className="hp" aria-hidden="true">
          <label htmlFor="weekly-gotcha">Leave this field blank</label>
          <input type="text" id="weekly-gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </div>
      </form>

      <form id="weekly-email-form" data-sample={sample ? "1" : undefined}>
        <label className="checkbox" htmlFor="weekly-opt-in">
          <input
            type="checkbox"
            id="weekly-opt-in"
            name="opted_in"
            value="yes"
            defaultChecked={optedIn}
            disabled={!canEmail}
          />
          <span>
            {weeklyEmailConsentLabel()}
            <span className="consent-sender">{alertConsentSender()}</span>
          </span>
        </label>
        <p className="hint">
          {canEmail
            ? "Off until you turn it on. We email you only when there is at least one strong match."
            : "Save a resume first. The email stays off until you turn it on."}
        </p>
        <button className="apply-btn secondary" type="submit" id="weekly-email-btn" disabled={!canEmail}>
          Save email setting
        </button>
      </form>

      <div id="weekly-status" className="status" role="status" aria-live="polite" hidden />

      <div id="weekly-results">
        <h3>Latest list</h3>
        {results && results.jobs.length > 0 ? (
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
        ) : results ? (
          <p>No strong matches {checkedOn ? `on ${checkedOn}` : "last Saturday"}. We did not send an email.</p>
        ) : (
          <p>Nothing here yet. After you save a resume and turn on the email, the Saturday list shows up here.</p>
        )}
      </div>
    </div>
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
