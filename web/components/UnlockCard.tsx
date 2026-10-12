import { PaywallView } from "@/components/AnalyticsEvents";
import { closingLabel, pillLabel } from "@/lib/format";
import { paywallDetail, type PaywallPlace, type PaywallPreview } from "@/lib/paywall";

export function UnlockCard({
  total,
  shown,
  place,
  employerName,
  filtering = false,
  focus = "",
  preview = null,
}: {
  total: number;
  shown: number;
  place: PaywallPlace;
  employerName?: string;
  filtering?: boolean;
  focus?: string;
  preview?: PaywallPreview | null;
}) {
  const remaining = Math.max(0, total - shown);
  if (remaining === 0) return null;
  const noun = remaining === 1 ? "opening" : "openings";
  const detail = preview
    ? paywallDetail({
        place,
        remaining,
        highPay: Math.min(preview.highPay, remaining),
        employerName,
        focus,
        filtering,
      })
    : `This list shows the newest ${shown} of ${total.toLocaleString("en-CA")}. The rest of the filtered list is part of a membership.`;
  const teasers = (preview?.teasers || []).slice(0, Math.min(5, remaining));

  return (
    <>
      {teasers.length > 0 ? (
        <ul className="job-list job-teasers" aria-hidden="true">
          {teasers.map((row, index) => {
            const close = closingLabel(row.closing);
            const type = pillLabel(row.type);
            return (
              <li key={index}>
                <div className="job-row job-teaser">
                  <span className="job-main">
                    <span className="job-title job-teaser-title">Member-only job</span>
                    {type ? (
                      <span className="job-sub">
                        <span className="pill">{type}</span>
                      </span>
                    ) : null}
                  </span>
                  {row.salary || close.text ? (
                    <span className="job-side">
                      {row.salary ? <span className="job-teaser-salary">{row.salary}</span> : null}
                      {close.text ? (
                        <time
                          className={close.urgent ? "job-closing is-urgent" : "job-closing"}
                          dateTime={row.closing}
                        >
                          {close.text}
                        </time>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <section className="unlock" aria-label="More openings">
        <PaywallView />
        <h2>
          {remaining.toLocaleString("en-CA")} more {noun}
        </h2>
        <p>
          {detail} Apply stays free on every job page.
        </p>
        <p className="unlock-actions">
          <a className="apply-btn" href="/pricing/">
            See membership
          </a>
          <a href="/login/">Sign in</a>
        </p>
      </section>
    </>
  );
}
