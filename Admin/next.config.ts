import type { NextConfig } from "next";

/** Backend base URL (server-side only). Browser requests to /api/* are proxied here. */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async rewrites() {
    // Same-origin proxy: the panel calls `/api/...`, so auth cookies stay first-party and no CORS is needed.
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    // Never index or frame the admin panel.
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "X-Frame-Options", value: "DENY" }] }];
  },
};

export default nextConfig;
