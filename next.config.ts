import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  // Docker: `web` konteyneri uchun minimal serverli build (§4.1).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,

  /**
   * Xavfsizlik sarlavhalari (§6) — ilova darajasida.
   *
   * nginx da ham qatlam bor edi, lekin ilova undan mustaqil ishga tushishi
   * mumkin (`npm start`, boshqa reverse-proxy orqasida) va o'shanda himoya
   * butunlay yo'q edi. Endi siyosat manbasi shu yerda.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders({ isDev: process.env.NODE_ENV !== 'production' }),
      },
    ];
  },
};

export default nextConfig;
