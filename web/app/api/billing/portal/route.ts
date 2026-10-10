import { getViewer, requestOrigin } from "@/lib/auth";
import { BillingNotConfiguredError, createPortalSession } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer.email) return Response.json({ error: "Sign in first." }, { status: 401 });
  const customer = viewer.profile?.stripe_customer_id;
  if (!customer) return Response.json({ error: "No billing customer is stored yet." }, { status: 409 });
  try {
    const origin = await requestOrigin();
    const session = await createPortalSession({ stripeCustomerId: customer, origin });
    return Response.json(session);
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 501 });
    }
    throw error;
  }
}
