import { refundSentence } from "@/lib/legal-copy";

export function AccountDeleteCopy() {
  return (
    <p className="account-disclaimer">
      This removes your profile, match history, any resume you saved for weekly matches, the weekly match list, and the
      jobs you marked as applied. Billing records the law requires, such as payment records, are kept. If a membership
      is still renewing, we cancel it first. If that cancellation cannot be completed, deletion waits until you cancel
      from Manage billing.
    </p>
  );
}

export function AccountRefundCopy() {
  return <p className="account-disclaimer">{refundSentence()}</p>;
}
