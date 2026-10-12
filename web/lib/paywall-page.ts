export type PaywallPage = "home" | "jobs" | "employer" | "match" | "other";

/** Which list the membership card is on. Job pages and the employer index are "other". */
export function paywallPage(pathname: string): PaywallPage {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/jobs") return "jobs";
  if (path === "/match") return "match";
  if (/^\/employers\/[^/]+$/.test(path)) return "employer";
  return "other";
}
