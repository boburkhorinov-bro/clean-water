/**
 * Xavfsizlik sarlavhalari — ilova darajasidagi qatlam (§6).
 *
 * Bu siyosat nginx dagisining nusxasi emas, MANBASI: `next.config.ts` uni
 * har bir javobga qo'yadi, `docker/nginx/conf.d/default.conf` esa aynan shu
 * satrni takrorlaydi (mosligini `security-headers.nginx.test.ts` tekshiradi).
 * Sabab: ilova nginx siz ham ishga tushishi mumkin — o'sha holatda ham
 * himoyasiz qolmasin. Ikki bir xil sarlavha brauzer uchun muammo emas;
 * ular FARQ qilsa, brauzer ikkalasini ham qo'llaydi va sahifa tushunarsiz
 * tarzda buziladi — shuning uchun ular bir xil bo'lishi shart.
 */

export interface SecurityHeaderOptions {
  /** `next dev`: HMR `eval` talab qiladi, HSTS esa lokal HTTP ni o'ldiradi. */
  isDev: boolean;
}

export interface HeaderPair {
  key: string;
  value: string;
}

/**
 * `'unsafe-inline'` script uchun ataylab qoldirilgan: Next.js sahifa
 * ma'lumotini inline `<script>` da yuboradi. Nonce bilan almashtirish
 * mumkin edi, lekin nonce har so'rovda o'zgaradi va sahifalarni ISR dan
 * (60 s kesh, §4.8) dinamik renderga tushirib yuborardi — SEO uchun
 * yaratilgan statik HTML yo'qolardi.
 */
export function buildContentSecurityPolicy({ isDev }: SecurityHeaderOptions): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    // Telegram Mini App SDK skripti.
    'https://telegram.org',
  ];
  if (isDev) scriptSrc.splice(1, 0, "'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    // CSS modullari va Next.js ning kritik inline stillari.
    "style-src 'self' 'unsafe-inline'",
    // Rasmlar faqat o'zimizdan: kontent-bloklar sxemasi manzilni `/media/`
    // bilan cheklaydi (src/lib/content-blocks.ts), tashqi manba yo'q.
    "img-src 'self' data:",
    // Shriftlar `next/font` orqali o'z domenimizdan beriladi.
    "font-src 'self' data:",
    // Videolar Kinescope pleyeri orqali (§3).
    'frame-src https://kinescope.io',
    "connect-src 'self' https://api.telegram.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Mini App Telegram Web ichida iframe da ochiladi — ruxsatsiz oq ekran.
    "frame-ancestors 'self' https://web.telegram.org",
  ].join('; ');
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): HeaderPair[] {
  const headers: HeaderPair[] = [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(options) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];

  // `X-Frame-Options` ataylab YO'Q: `SAMEORIGIN` Telegram Web dagi Mini App ni
  // bloklardi, `ALLOW-FROM` esa hech qayerda qo'llanmaydi. Ramkalarni
  // boshqarish yagona joyda — CSP `frame-ancestors` da.

  if (!options.isDev) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains; preload',
    });
  }

  return headers;
}
