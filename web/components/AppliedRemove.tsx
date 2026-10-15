"use client";

import { useState } from "react";

/** Removes one entry from the applied list. Same endpoint as the job page toggle. */
export function AppliedRemove({ jobKey, title }: { jobKey: string; title: string }) {
  const [state, setState] = useState<"idle" | "pending" | "removed" | "error">("idle");

  async function onClick() {
    if (state === "pending" || state === "removed") return;
    setState("pending");
    try {
      const response = await fetch("/api/applications/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ path: jobKey, applied: false }),
      });
      const data = (await response.json().catch(() => null)) as { applied?: unknown } | null;
      if (response.ok && data?.applied === false) {
        setState("removed");
        const row = document.getElementById(`applied-${jobKey.replace(/[^a-z0-9-]/gi, "-")}`);
        if (row) row.hidden = true;
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      className="applied-remove"
      aria-label={`Remove ${title} from jobs I applied to`}
      aria-busy={state === "pending"}
      disabled={state === "pending" || state === "removed"}
      onClick={onClick}
    >
      {state === "error" ? "Try again" : "Remove"}
    </button>
  );
}
