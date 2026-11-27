"use client";

import { closingSoonPhrase, torontoTodayIso } from "@/lib/format";
import { useEffect, useState } from "react";

/**
 * Relative closing line, filled in the browser from the closing date.
 * The server render stays empty so an ISR page does not keep yesterday's "Closes today".
 */
export function ClosingSoon({ iso }: { iso: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(closingSoonPhrase(iso, torontoTodayIso()));
  }, [iso]);

  if (!text) return null;
  return <span className="closing-soon"> · {text}</span>;
}
