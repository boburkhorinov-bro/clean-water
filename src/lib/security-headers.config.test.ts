import { describe, expect, test } from 'vitest';
import nextConfig from '../../next.config';
import { buildSecurityHeaders } from './security-headers';

/**
 * Siyosat yozilgani yetmaydi — u javobga ulanishi kerak (§6).
 * Bu test aynan shu ulanishni ushlab turadi.
 */
describe('next.config.ts: xavfsizlik sarlavhalari', () => {
  test('sarlavhalar barcha marshrutlarga qo‘llanadi', async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map((rule) => rule.source)).toContain('/:path*');
  });

  test('javobda CSP bor', async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === '/:path*');
    expect(all?.headers.map((header) => header.key)).toContain('Content-Security-Policy');
  });

  /**
   * nginx yo'qolganda (PaaS ga ko'chish) `/media/` uchun qat'iy siyosat ham
   * u bilan birga yo'qolardi. Papkaga qandaydir yo'l bilan HTML tushsa, u
   * to'liq huquqli sahifa sifatida ochilardi.
   *
   * Bu yerda ILOVA CSP si ham qo'llanadi, ya'ni javobda ikkita siyosat
   * bo'ladi. nginx da bu taqiqlangan edi, lekin sabab boshqa edi: u yerda
   * eskirgan siyosat ilovaning YANGI ruxsatlarini bloklardi. Bu yerda esa
   * ikkalasi kesishadi va natija eng qattig'i bo'ladi — `default-src 'none'`.
   * Statik rasm uchun aynan shu kerak.
   */
  test('`/media/` o‘z qat‘iy siyosatini oladi', async () => {
    const rules = await nextConfig.headers!();
    const media = rules.find((rule) => rule.source.startsWith('/media/'));

    expect(media, '/media/ uchun qoida yo‘q').toBeDefined();

    const csp = media?.headers.find((header) => header.key === 'Content-Security-Policy');
    expect(csp?.value).toContain("default-src 'none'");
    expect(csp?.value).toContain('sandbox');

    const nosniff = media?.headers.find((header) => header.key === 'X-Content-Type-Options');
    expect(nosniff?.value).toBe('nosniff');
  });

  test('to‘plam `buildSecurityHeaders` bilan bir xil — ikkinchi ro‘yxat yuritilmaydi', () => {
    const isDev = process.env.NODE_ENV !== 'production';
    expect(buildSecurityHeaders({ isDev }).map((header) => header.key)).toEqual([
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]);
  });
});
