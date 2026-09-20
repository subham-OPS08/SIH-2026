import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL;

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    if (BACKEND_URL && !BACKEND_URL.includes("localhost") && !BACKEND_URL.includes("127.0.0.1")) {
      return [
        {
          source: "/api/v1/:path*",
          destination: `${BACKEND_URL}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
