import { getStripe } from "./billing";
import { query } from "./db";

export class AccountDeleteBlocked extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountDeleteBlocked";
  }
}

export async function deleteAccount(profileId: string): Promise<void> {
  const rows = await query<{
    email: string;
    customer_name: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    plan: string | null;
    membership_status: string;
  }>(
    `select email, customer_name, stripe_customer_id, stripe_subscription_id, plan, membership_status
     from profiles where id = $1`,
    [profileId],
  );
  const profile = rows[0];
  if (!profile) return;
  if (
    profile.stripe_subscription_id &&
    (profile.membership_status === "active" || profile.membership_status === "past_due")
  ) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new AccountDeleteBlocked("Cancel the membership from Manage billing before deleting the account.");
    }
    try {
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/no such subscription/i.test(message)) {
        throw new AccountDeleteBlocked("Cancel the membership from Manage billing before deleting the account.");
      }
    }
  }
  await query(
    `insert into billing_records
       (email, customer_name, stripe_customer_id, stripe_subscription_id, plan, retained_reason)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      profile.email,
      profile.customer_name,
      profile.stripe_customer_id,
      profile.stripe_subscription_id,
      profile.plan,
      "Kept for tax and consumer-law records after the account was deleted.",
    ],
  );
  await query(`delete from resume_match_usage where profile_id = $1`, [profileId]);
  await query(`delete from profiles where id = $1`, [profileId]);
  await query(`select app_private.delete_auth_user($1)`, [profileId]);
}
