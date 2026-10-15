import { planPixel } from "./site";

export type PurchasePixel = {
  eventId: string;
  value: number;
  contentName: string;
};

type SessionLike = {
  id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  client_reference_id?: string | null;
  metadata?: { [key: string]: string | null | undefined } | null;
};

/** Paid Checkout sessions only. The amount is the plan price before tax. */
export function purchasePixelFromSession(session: SessionLike, profileId: string): PurchasePixel | null {
  if (!session.id || session.status !== "complete" || session.payment_status !== "paid") return null;
  const owner = session.client_reference_id || session.metadata?.profile_id || "";
  if (!profileId || owner !== profileId) return null;
  const pixel = planPixel(session.metadata?.plan || "");
  if (!pixel) return null;
  return { eventId: session.id, value: pixel.value, contentName: pixel.contentName };
}

export function isCheckoutSessionId(value: string): boolean {
  return /^cs_[A-Za-z0-9_]+$/.test(value) && value.length <= 255;
}
