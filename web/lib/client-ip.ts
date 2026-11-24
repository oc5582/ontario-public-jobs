/** Client IP as the platform reports it. Callers store a hash, not this value. */
export function clientIpFrom(headerStore: { get(name: string): string | null }): string {
  const real = (headerStore.get("x-real-ip") || "").trim();
  if (real) return real.slice(0, 64);
  const forwarded = (headerStore.get("x-forwarded-for") || "").split(",")[0]?.trim() || "";
  return forwarded.slice(0, 64) || "unknown";
}
