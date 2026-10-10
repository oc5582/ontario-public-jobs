import type { NextConfig } from "next";
import legacyRedirects from "./legacy-redirects.json";

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
};

export default nextConfig;
