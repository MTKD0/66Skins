import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Google VM deployment serves the original local assets directly.
  // Cloudflare's image optimizer binding is not available there, and its
  // fallback redirect would downgrade HTTPS asset URLs to HTTP.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
