"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    if (value === initial) return;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const next = value.trim();
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [value, initial, router]);

  return (
    <div className="search-field" role="search">
      <label htmlFor="job-search">Search titles and employers</label>
      <input
        id="job-search"
        name="q"
        type="search"
        autoComplete="off"
        spellCheck={false}
        aria-controls="job-list"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}
