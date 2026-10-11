/**
 * Only same-site relative paths may be used as a post-login redirect.
 * Browsers ignore tab, CR, and LF inside a URL, so "/\t/evil.example" is
 * treated as a protocol-relative URL. Reject those, backslashes, schemes,
 * and encoded forms of the same tricks.
 */
const CONTROL = /[\u0000-\u001F\u007F\u2028\u2029]/;

function unsafePath(value: string): boolean {
  if (!value.startsWith("/")) return true;
  if (value.startsWith("//") || value.startsWith("/\\")) return true;
  if (value.includes("\\") || value.includes("//")) return true;
  if (CONTROL.test(value)) return true;
  return false;
}

function decodeLayers(value: string): string[] {
  const layers = [value];
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9a-fA-F]{2}/.test(current)) break;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      layers.push(next);
      current = next;
    } catch {
      layers.push("\u0000");
      break;
    }
  }
  return layers;
}

export function safeNext(value: string | null | undefined, fallback = "/account/"): string {
  if (value == null) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  for (const layer of decodeLayers(trimmed)) {
    if (unsafePath(layer)) return fallback;
  }
  let url: URL;
  try {
    url = new URL(trimmed, "https://publicjobs.ca");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://publicjobs.ca" || url.username || url.password) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (unsafePath(path)) return fallback;
  return path;
}
