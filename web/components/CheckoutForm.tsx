"use client";

import { useRef, useState } from "react";
import { checkoutCheckboxText } from "@/lib/legal-copy";
import { PLANS, type PlanId } from "@/lib/site";

function consentParts(plan: PlanId): { before: string; after: string } {
  const text = checkoutCheckboxText(plan);
  const at = text.indexOf("Terms");
  if (at < 0) return { before: text, after: "" };
  return { before: text.slice(0, at), after: text.slice(at + "Terms".length) };
}

function cardNote(id: PlanId, detail: string): string | null {
  if (id === "month") return null;
  return detail;
}

export function CheckoutForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [plan, setPlan] = useState<PlanId>("month");
  const agreeRef = useRef<HTMLInputElement>(null);
  const consent = consentParts(plan);

  function choose(next: PlanId) {
    setPlan(next);
    if (agreeRef.current) agreeRef.current.checked = false;
  }

  return (
    <form
      className="checkout-form"
      action={action}
      onSubmit={(event) => {
        const selectedPlan = new FormData(event.currentTarget).get("plan");
        if (agreeRef.current && typeof selectedPlan === "string") agreeRef.current.value = selectedPlan;
      }}
    >
      <fieldset>
        <legend>Select a plan</legend>
        <div className="plan-cards">
          {PLANS.map((item) => {
            const note = cardNote(item.id, item.detail);
            return (
              <label key={item.id} className="plan-card">
                <input
                  type="radio"
                  name="plan"
                  value={item.id}
                  checked={plan === item.id}
                  onChange={() => choose(item.id)}
                />
                <span className="plan-card-copy">
                  <span className="plan-card-name">{item.name}</span>
                  <span className="plan-card-price">
                    {item.price}
                    {item.id === "month" ? <span className="plan-card-unit">/month</span> : null}
                  </span>
                  {note ? <span className="plan-card-note">{note}</span> : null}
                  <span className="plan-card-tax">plus applicable GST/HST</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="checkbox terms-ack">
        <input ref={agreeRef} id="checkout-agree" type="checkbox" name="agree" value={plan} required />
        <span>
          <label htmlFor="checkout-agree">{consent.before}</label>
          <a href="/terms/">Terms</a>
          <label htmlFor="checkout-agree">{consent.after}</label>
        </span>
      </div>
      <button className="apply-btn" type="submit">
        Continue to secure payment
      </button>
    </form>
  );
}
