import { getViewer, requestOrigin } from "@/lib/auth";
import { BillingNotConfiguredError, createCheckoutSession } from "@/lib/billing";
import type { PlanId } from "@/lib/site";

export const dynamic = "force-dynamic";

function isPlan(value: unknown): value is PlanId {
  return value === "month" || value === "quarter" || value === "year";
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.email || !viewer.profile) {
    return Response.json({ error: "Sign in before checkout." }, { status: 401 });
  }
  let plan: PlanId;
  try {
    const body = (await request.json()) as { plan?: unknown };
    if (!isPlan(body.plan)) return Response.json({ error: "Unknown plan." }, { status: 400 });
    plan = body.plan;
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  try {
    const origin = await requestOrigin();
    const session = await createCheckoutSession({
      profileId: viewer.profile.id,
      email: viewer.email,
      plan,
      origin,
    });
    return Response.json(session);
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 501 });
    }
    throw error;
  }
}
