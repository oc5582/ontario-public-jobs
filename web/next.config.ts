import type { NextConfig } from "next";
import { unresolvedLegalPlaceholders } from "./lib/legal-config";
import { securityHeaders } from "./lib/security-headers";
import legacyRedirects from "./legacy-redirects.json";

const missingLegal = unresolvedLegalPlaceholders();
if (missingLegal.length && process.env.VERCEL_ENV === "production") {
  throw new Error(
    `Fill the placeholders in web/lib/legal-config.ts before a production build: ${missingLegal.join(", ")}`,
  );
}
if (missingLegal.length) {
  console.warn(
    `Legal placeholders are still open (${missingLegal.join(", ")}). A production build will refuse them. Preview and local builds may keep them.`,
  );
}

const legacy = (legacyRedirects as { from: string; to: string }[]).map((item) => ({
  source: item.from,
  destination: item.to.endsWith("/") ? item.to : `${item.to}/`,
  permanent: true,
}));

const nextConfig: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/jobs/page/:page", destination: "/jobs/", permanent: true },
      ...legacy,
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
      {
        // IndexNow verifies this exact URL. File URLs are not given a trailing slash.
        source: "/73ae3ce2e86e564e9a35eadf85dcb3d6.txt",
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      },
    ];
  },
};

export default nextConfig;
