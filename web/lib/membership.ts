import { formatLongDate } from "./format";

export function formatTorontoTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatLongDate(value);
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return formatLongDate(iso);
}

export function grantsMemberAccess(
  profile: { membership_status: string; current_period_end: string | null } | null,
  now = Date.now(),
): boolean {
  if (!profile || profile.membership_status !== "active") return false;
  if (!profile.current_period_end) return true;
  return new Date(profile.current_period_end).getTime() > now;
}

export function membershipPeriodLabel(profile: {
  membership_status: string;
  current_period_end: string | null;
  cancel_at: string | null;
}): string {
  if (profile.membership_status === "active" && profile.cancel_at) {
    const when = formatTorontoTimestamp(profile.cancel_at);
    return when ? `Cancels ${when}. Access continues until then.` : "";
  }
  if (profile.membership_status === "active" && profile.current_period_end) {
    const when = formatTorontoTimestamp(profile.current_period_end);
    return when ? `Renews ${when}.` : "";
  }
  if (profile.membership_status === "canceled" && profile.current_period_end) {
    const when = formatTorontoTimestamp(profile.current_period_end);
    return when ? `Ended ${when}.` : "";
  }
  if (profile.membership_status === "past_due") {
    return "The last payment failed. Update the card from Manage billing.";
  }
  return "";
}
