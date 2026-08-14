import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Docker: `web` konteyneri uchun minimal serverli build (§4.1).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
};

export default nextConfig;
