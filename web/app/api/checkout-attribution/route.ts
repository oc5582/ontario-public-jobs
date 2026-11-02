import { getStripe } from "@/lib/billing";
import { isCheckoutSessionId } from "@/lib/guest-checkout";

export const dynamic = "force-dynamic";

const PROBE = "attr-20261102";

function attributionOnly(metadata: { [key: string]: string } | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!metadata) return out;
  for (const [key, value] of Object.entries(metadata)) {
    if (
      key.startsWith("utm_") ||
      key.startsWith("last_utm_") ||
      key === "fbclid" ||
      key === "gclid" ||
      key === "last_fbclid" ||
      key === "last_gclid"
    ) {
      out[key] = value;
    }
  }
  return out;
}

/** Temporary preview probe. Removed after the attribution check. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("probe") !== PROBE) return Response.json({ error: "Not found." }, { status: 404 });
  const sessionId = url.searchParams.get("session_id") || "";
  if (!isCheckoutSessionId(sessionId)) return Response.json({ error: "Bad session." }, { status: 400 });
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  const subscription = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
  return Response.json({
    id: session.id,
    livemode: session.livemode,
    mode: session.mode,
    status: session.status,
    metadata: attributionOnly(session.metadata),
    subscription_id: subscription?.id || (typeof session.subscription === "string" ? session.subscription : null),
    subscription_metadata: attributionOnly(subscription?.metadata),
  });
}
