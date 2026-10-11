import { getViewer, requestOrigin } from "@/lib/auth";
import { isProvinceCode } from "@/lib/ca-tax";
import { AlreadySubscribedError, BillingNotConfiguredError, createCheckoutSession } from "@/lib/billing";
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
  let customerName = "";
  let province = "";
  try {
    const body = (await request.json()) as {
      plan?: unknown;
      agree?: unknown;
      customer_name?: unknown;
      province?: unknown;
    };
    if (!isPlan(body.plan)) return Response.json({ error: "Unknown plan." }, { status: 400 });
    if (body.agree !== true && body.agree !== body.plan) {
      return Response.json({ error: "Agree to the Terms before checkout." }, { status: 400 });
    }
    customerName = String(body.customer_name || "").trim();
    if (customerName.length < 2 || customerName.length > 120) {
      return Response.json({ error: "Enter the name to put on the agreement." }, { status: 400 });
    }
    province = String(body.province || "");
    if (!isProvinceCode(province)) {
      return Response.json({ error: "Choose a Canadian billing province." }, { status: 400 });
    }
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
      province,
      customerName,
    });
    return Response.json(session);
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 501 });
    }
    if (error instanceof AlreadySubscribedError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
