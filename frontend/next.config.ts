import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-only badge while comparing the experimental layouts.
  devIndicators: false,
  // The browser calls /api on this site; Next.js passes it on to the backend.
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
