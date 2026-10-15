import { getStripe } from "./billing";
import { query } from "./db";
import { isCheckoutSessionId, purchasePixelFromSession, type PurchasePixel } from "./meta-purchase-rules";

export { isCheckoutSessionId, purchasePixelFromSession, type PurchasePixel };

function missingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42P01";
}

/**
 * Inserts the Checkout session id and returns the pixel payload only for the
 * request that won the insert. A refresh finds the row and gets null.
 * If the migration has not been applied yet, the payload is still returned
 * so the browser can fire once and remember it in localStorage.
 */
export async function claimPurchasePixel(sessionId: string, profileId: string): Promise<PurchasePixel | null> {
  if (!isCheckoutSessionId(sessionId)) return null;
  let session: Awaited<ReturnType<ReturnType<typeof getStripe>["checkout"]["sessions"]["retrieve"]>>;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "meta_purchase_session_failed",
        message: error instanceof Error ? error.message.slice(0, 160) : "failed",
      }),
    );
    return null;
  }
  const pixel = purchasePixelFromSession(session, profileId);
  if (!pixel) return null;
  try {
    const rows = await query<{ session_id: string }>(
      `insert into meta_purchase_events (session_id)
       values ($1)
       on conflict (session_id) do nothing
       returning session_id`,
      [pixel.eventId],
    );
    if (rows.length === 0) return null;
    return pixel;
  } catch (error) {
    if (missingTable(error)) {
      console.error(
        JSON.stringify({
          event: "meta_purchase_table_missing",
          message: "Apply supabase/migrations/20261015140000_meta_purchase_events.sql",
        }),
      );
      return pixel;
    }
    console.error(
      JSON.stringify({
        event: "meta_purchase_claim_failed",
        message: error instanceof Error ? error.message.slice(0, 160) : "failed",
      }),
    );
    return null;
  }
}
