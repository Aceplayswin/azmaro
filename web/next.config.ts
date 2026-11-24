import type { NextConfig } from "next";

/** Backend base URL (server-side only). Browser requests to /api/* are proxied here. */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  images: {
    // Product imagery is hosted locally under /public/images. Remote hosts are
    // intentionally not whitelisted: images must be reviewed and downloaded first.
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  // Hide the Next.js "N" dev-tools badge shown in development.
  devIndicators: false,
  async rewrites() {
    // Same-origin proxy: client code keeps calling `/api/...`, cookies stay first-party, no CORS.
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
