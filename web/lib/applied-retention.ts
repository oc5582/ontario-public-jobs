import { withTransaction } from "./db";

/** Days an ended membership's applied list stays hidden before it is deleted. */
export const APPLIED_RETENTION_DAYS = 30;

/**
 * SQL for "this profile grants member access". Must match grantsMemberAccess in membership.ts.
 * The owner comp (active, no period end) always matches.
 */
const HAS_ACCESS = `(p.membership_status = 'active' and (p.current_period_end is null or p.current_period_end > now()))`;

/**
 * When the list became hidden: the end of the paid period if that is already past,
 * otherwise now. Never in the future, so a bad date cannot push deletion out forever,
 * and never earlier than the period end, so deletion is never early.
 */
export const HIDDEN_SINCE_SQL = `least(now(), coalesce(p.current_period_end, now()))`;

export type AppliedCleanupResult = { cleared: number; hidden: number; deletedRows: number; deletedUsers: number };

/**
 * Daily cleanup, one transaction:
 * 1. members with access: clear the hidden date (the trigger also does this on rejoin);
 * 2. ended memberships with marks: record when the list became hidden, once;
 * 3. delete marks hidden for more than APPLIED_RETENTION_DAYS.
 * Step 3 never touches a profile whose status is 'active', even if its period end looks past,
 * so a late Stripe webhook cannot cost a paying member their list.
 */
export async function purgeLapsedApplications(): Promise<AppliedCleanupResult> {
  return withTransaction(async (client) => {
    const cleared = await client.query(
      `update profiles p set applications_hidden_since = null
       where p.applications_hidden_since is not null and ${HAS_ACCESS}`,
    );
    const hidden = await client.query(
      `update profiles p set applications_hidden_since = ${HIDDEN_SINCE_SQL}
       where p.applications_hidden_since is null
         and not ${HAS_ACCESS}
         and exists (select 1 from applications a where a.user_id = p.id)`,
    );
    const deleted = await client.query<{ user_id: string }>(
      `delete from applications a
       using profiles p
       where a.user_id = p.id
         and p.membership_status <> 'active'
         and p.applications_hidden_since is not null
         and p.applications_hidden_since < now() - make_interval(days => $1)
       returning a.user_id`,
      [APPLIED_RETENTION_DAYS],
    );
    return {
      cleared: cleared.rowCount || 0,
      hidden: hidden.rowCount || 0,
      deletedRows: deleted.rowCount || 0,
      deletedUsers: new Set(deleted.rows.map((row) => row.user_id)).size,
    };
  });
}
