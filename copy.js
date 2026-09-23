/** All UI strings — Product Lead draft placeholders */
window.COPY = {
  productName: "Ontario Public Jobs",
  whoItsFor:
    "Job seekers watching government-owned corporations and agencies hiring in Toronto, the GTA, or hybrid-Toronto",
  promise:
    "Matching Crown and agency openings in Toronto / GTA / hybrid-Toronto with real apply links and full job descriptions on this site — not another generic board",
  caslConsent:
    "I agree to receive job-match emails at this address. I can unsubscribe anytime.",
  softPayAsk:
    "If this saved you time each week, would you pay a small monthly fee for it?",
  softPayOptions: [
    { value: "yes", label: "Yes" },
    { value: "maybe", label: "Maybe" },
    { value: "no", label: "No" },
  ],
  form: {
    emailLabel: "Email",
    submit: "Get the list",
  },
  listings: {
    heading: "Current Crown and agency openings",
    loading: "Loading listings…",
    empty: "No listings to show.",
    error: "Could not load listings.",
    count: (n) => `${n} opening${n === 1 ? "" : "s"}`,
    columns: {
      title: "Title",
      employer: "Employer",
      location: "Location",
      closing_date: "Closes",
    },
  },
  signup: {
    successPreview:
      "You’re on the list. We’ll email openings to this address.",
    successSent: "You’re on the list. We’ll email openings to this address.",
    error: "Something went wrong. Please try again.",
    validation: "Please enter your email and agree to receive emails.",
  },
};
