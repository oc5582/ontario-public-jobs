"use client";

import { useEffect, useState } from "react";
import { resendCheckoutSignIn } from "@/app/billing/actions";

const requested = new Set<string>();

export function CheckoutSignInRequest({
  sessionId,
  auto,
}: {
  sessionId: string;
  auto: boolean;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!auto || requested.has(sessionId)) return;
    const storageKey = `pj-checkout-signin-${sessionId}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Private mode can block storage. The in-memory set still limits this page load.
    }
    requested.add(sessionId);
    setPending(true);
    const data = new FormData();
    data.set("session_id", sessionId);
    void resendCheckoutSignIn(data);
  }, [auto, sessionId]);

  return (
    <form action={resendCheckoutSignIn}>
      <input type="hidden" name="session_id" value={sessionId} />
      <button className="apply-btn" type="submit" disabled={pending}>
        {pending ? "Sending a sign-in link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
