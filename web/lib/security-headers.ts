/**
 * Headers for every response. Checkout and the billing portal are full-page
 * redirects to Stripe, so this policy does not frame those pages. It does
 * allow the scripts the site actually loads: our own, the Cloudflare beacon,
 * the Meta Pixel (injected only after consent), pdf.js from jsdelivr,
 * Stripe.js in case a Stripe page is embedded later, and Vercel Web Analytics.
 * The production script is /_vercel/insights/script.js on this origin, and
 * page views and events POST to /_vercel/insights/view and /_vercel/insights/event.
 * Both are covered by 'self'. Development loads the script from va.vercel-scripts.com.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://ontario-public-jobs-signup.publicjobs.workers.dev",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://static.cloudflareinsights.com https://connect.facebook.net https://cdn.jsdelivr.net https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.facebook.com https://*.facebook.com https://*.stripe.com",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co https://ontario-public-jobs-signup.publicjobs.workers.dev https://cdn.jsdelivr.net https://www.facebook.com https://*.facebook.com https://connect.facebook.net https://static.cloudflareinsights.com https://cloudflareinsights.com https://api.stripe.com https://*.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://billing.stripe.com https://*.stripe.com",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
].join("; ");

export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

export function securityHeaders(): { key: string; value: string }[] {
  // Vercel injects its preview toolbar from vercel.live. Production does not.
  let csp = CONTENT_SECURITY_POLICY;
  if (process.env.VERCEL_ENV !== "production") {
    csp = csp
      .replace("script-src 'self'", "script-src 'self' https://vercel.live")
      .replace("connect-src 'self'", "connect-src 'self' https://vercel.live")
      .replace("frame-src ", "frame-src https://vercel.live ");
  }
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ];
}
