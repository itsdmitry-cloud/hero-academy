import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/landing.html",
      },
    ];
  },
};

export default nextConfig;
