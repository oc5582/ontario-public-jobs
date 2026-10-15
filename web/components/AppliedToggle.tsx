"use client";

import { useState } from "react";

export function AppliedToggle({ jobKey, initial }: { jobKey: string; initial: boolean }) {
  const [applied, setApplied] = useState(initial);
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (pending) return;
    const next = !applied;
    setPending(true);
    try {
      const response = await fetch("/api/applications/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ path: jobKey, applied: next }),
      });
      const data = (await response.json().catch(() => null)) as { applied?: unknown } | null;
      if (response.ok && typeof data?.applied === "boolean") setApplied(data.applied);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="apply-btn secondary"
      aria-pressed={applied}
      aria-busy={pending}
      disabled={pending}
      onClick={onClick}
    >
      {applied ? "Applied ✓ (undo)" : "Mark as applied"}
    </button>
  );
}
