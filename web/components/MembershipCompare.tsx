/** Four-row comparison shared by /start screen 16 and /pricing. No button. */
export function MembershipCompare({
  employers,
  headingId = "compare-h",
}: {
  employers: number;
  headingId?: string;
}) {
  const count = employers.toLocaleString("en-CA");
  const rows = [
    {
      own: `Check ${count} employer career sites, one by one`,
      member: `All ${count} in one list, refreshed every weekday`,
    },
    {
      own: "Scroll everything to find your fit",
      member: "Filter by type, area, level; sort by salary",
    },
    {
      own: "Re-check sites to spot new jobs",
      member: "Weekly match email (Sat)",
    },
    {
      own: "Guess which jobs fit your resume",
      member: "Unlimited resume matches, every day",
    },
  ];

  return (
    <>
      <h2 id={headingId} className="compare-title">
        Your search, without us and with us
      </h2>
      <p className="compare-lead">Same jobs. A lot less of your time.</p>
      <div className="quiz-cmp" role="table" aria-label="On your own compared with a membership">
        <div className="quiz-cmp-h quiz-cmp-l" role="columnheader">
          On your own
        </div>
        <div className="quiz-cmp-h quiz-cmp-r" role="columnheader">
          With membership
        </div>
        {rows.map((row) => (
          <div className="quiz-cmp-row" key={row.own}>
            <div className="quiz-cmp-cell quiz-cmp-l" role="cell">
              {row.own}
            </div>
            <div className="quiz-cmp-cell quiz-cmp-r" role="cell">
              {row.member}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
