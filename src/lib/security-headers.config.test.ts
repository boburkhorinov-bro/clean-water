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
