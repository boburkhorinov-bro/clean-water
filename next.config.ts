import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  /**
   * `standalone` — FAQAT Docker uchun (§4.1): konteynerga minimal server
   * chiqadi. PaaS (Vercel) o'z build chiqishini yasaydi va bu qiymat unga
   * xalaqit berishi mumkin, shuning uchun u aniq belgilanadi.
   * `Dockerfile` da `BUILD_TARGET=docker` beriladi.
   */
  ...(process.env.BUILD_TARGET === 'docker' ? { output: 'standalone' as const } : {}),
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
      {
        /**
         * Yuklangan media — o'z qat'iy siyosati bilan (§6).
         *
         * Ilgari buni nginx berardi; PaaS da nginx yo'q va siyosat u bilan
         * birga yo'qolardi. Papkaga qandaydir yo'l bilan HTML tushsa, u
         * to'liq huquqli sahifa sifatida ochilardi.
         *
         * Bu yerda ilova siyosati ham qo'llanadi, ya'ni javobda ikkita CSP
         * bo'ladi. nginx da bu taqiqlangan edi, sabab esa boshqa edi:
         * o'sha yerda eskirgan siyosat ilovaning YANGI ruxsatlarini
         * jimgina bloklardi. Bu yerda ikkalasi kesishadi va natija eng
         * qattig'i bo'ladi — statik rasm uchun aynan shu kerak.
         */
        source: '/media/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; sandbox; base-uri 'none'; form-action 'none'",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
