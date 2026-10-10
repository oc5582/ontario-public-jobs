/**
 * Drafting notes for counsel. These are not legal terms and do not replace
 * the page body. The existing legal wording is left unchanged.
 */
export function LegalTodo({ page }: { page: "terms" | "privacy" }) {
  const items =
    page === "terms"
      ? [
          "TODO: Auto-renewal. State that each plan renews automatically at the same price until the member cancels, and how renewal reminders are sent.",
          "TODO: HST. State whether the prices include tax, and the tax treatment if GST/HST applies.",
          "TODO: Refunds. State whether the 14-day refund is full or partial, how it is paid, the timing, and whether it applies to renewals.",
          "TODO: Processors. Name Stripe (card and billing), Vercel (hosting, IP address, and logs), and Supabase (accounts), and what each one processes.",
          "TODO: Telephone. Add a telephone number to the supplier identity.",
        ]
      : [
          "TODO: Processors. Name Stripe (card and billing), Vercel (hosting, IP address, and logs), and Supabase (accounts), and what personal information each one processes.",
          "TODO: Telephone. Add a telephone number for the person responsible for privacy.",
          "TODO: Auto-renewal, HST, and refunds are membership terms. The terms page lists the same gaps for counsel. Do not treat this note as the policy.",
        ];
  return (
    <aside className="legal-todo" aria-label="Drafting notes for counsel">
      <h2>TODO for counsel. Not part of this {page === "terms" ? "agreement" : "policy"}.</h2>
      <p>
        The wording above is unchanged and is waiting for a lawyer. The notes below are placeholders for gaps a
        pre-launch review listed. They are not terms and they are not a privacy promise.
      </p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
