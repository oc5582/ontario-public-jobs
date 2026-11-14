"use client";

import { searchQuery } from "@/lib/filters";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Typing stays in this input. The query is published through `onSearch`
 * instead of `router.replace`. A Next navigation from `/` to `/?q=` swaps the
 * cached page for the dynamic one and unmounts the field. The draft survives
 * that swap so a replacement input keeps the text and the caret.
 */
type SearchDraft = { text: string; caret: number; restore: boolean };
let searchDraft: SearchDraft | null = null;

export function SearchField({
  initial,
  onSearch,
}: {
  initial: string;
  onSearch: (query: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(() => (searchDraft?.restore ? searchDraft.text : initial));
  const valueRef = useRef(value);
  const onSearchRef = useRef(onSearch);
  valueRef.current = value;
  onSearchRef.current = onSearch;

  useLayoutEffect(() => {
    const el = inputRef.current;
    const draft = searchDraft;
    if (!el || !draft?.restore) return;
    const place = () => {
      const caret = Math.min(draft.caret, el.value.length);
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        // Some browsers reject selection changes on type="search".
      }
    };
    el.focus();
    place();
    window.requestAnimationFrame(place);
  }, []);

  useEffect(() => {
    const next = searchQuery(value);
    const current = searchQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    if (next === current) return;
    const handle = window.setTimeout(() => {
      const latest = searchQuery(valueRef.current);
      const now = searchQuery(new URLSearchParams(window.location.search).get("q") ?? "");
      if (latest === now) return;
      onSearchRef.current(latest);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [value]);

  return (
    <div className="search-field" role="search">
      <label htmlFor="job-search">Search titles and employers</label>
      <input
        ref={inputRef}
        id="job-search"
        name="q"
        type="search"
        autoComplete="off"
        spellCheck={false}
        aria-controls="job-list"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          searchDraft = {
            text: next,
            caret: event.target.selectionStart ?? next.length,
            restore: true,
          };
          setValue(next);
        }}
        onBlur={(event) => {
          const text = event.currentTarget.value;
          const caret = event.currentTarget.selectionStart ?? text.length;
          if (event.relatedTarget instanceof Element) {
            searchDraft = { text, caret, restore: false };
            return;
          }
          window.requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el && el.isConnected && document.activeElement !== el) {
              searchDraft = {
                text: el.value,
                caret: el.selectionStart ?? el.value.length,
                restore: false,
              };
            }
          });
        }}
      />
    </div>
  );
}
