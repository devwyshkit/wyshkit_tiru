import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    // ppr: 'incremental',
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    },
  },
  outputFileTracingRoot: path.join(__dirname),
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // Points to project root to fix "multiple lockfiles" / wrong workspace inference
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;