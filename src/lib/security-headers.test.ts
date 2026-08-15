import { describe, expect, test } from 'vitest';
import { buildContentSecurityPolicy, buildSecurityHeaders } from './security-headers';

/**
 * Xavfsizlik sarlavhalari (§6).
 *
 * CSP hozirgacha faqat nginx da edi. Ilova nginx siz ham ishga tushishi mumkin
 * (`npm start`, boshqa reverse-proxy orqasida) — o'shanda himoya butunlay
 * yo'qolardi. Shuning uchun siyosat ilovaning o'zida ham beriladi.
 */

function directive(csp: string, name: string): string {
  const found = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  if (!found) throw new Error(`CSP da "${name}" direktivasi yo'q: ${csp}`);
  return found;
}

describe('buildContentSecurityPolicy', () => {
  test('standart manba faqat o‘zimizniki', () => {
    expect(directive(buildContentSecurityPolicy({ isDev: false }), 'default-src')).toBe(
      "default-src 'self'",
    );
  });

  test('prodda skript uchun eval taqiqlanadi', () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'");
  });

  test('dev da eval ruxsat etiladi — Next.js HMR usiz ishlamaydi', () => {
    const csp = buildContentSecurityPolicy({ isDev: true });
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
  });

  test('Telegram Mini App uchun web.telegram.org iframe ga ruxsat', () => {
    // Mini App Telegram Web ichida iframe da ochiladi; ruxsatsiz oq ekran.
    expect(directive(buildContentSecurityPolicy({ isDev: false }), 'frame-ancestors')).toBe(
      "frame-ancestors 'self' https://web.telegram.org",
    );
  });

  test('Kinescope pleyeriga iframe ruxsati bor', () => {
    expect(directive(buildContentSecurityPolicy({ isDev: false }), 'frame-src')).toContain(
      'https://kinescope.io',
    );
  });

  test('plaginlar butunlay taqiqlanadi', () => {
    expect(directive(buildContentSecurityPolicy({ isDev: false }), 'object-src')).toBe(
      "object-src 'none'",
    );
  });

  test('base-uri va form-action begona manzilga ochilmaydi', () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
  });

  test('dev va prod farqi faqat eval da — qolgan siyosat bir xil', () => {
    const dev = buildContentSecurityPolicy({ isDev: true }).replace(" 'unsafe-eval'", '');
    expect(dev).toBe(buildContentSecurityPolicy({ isDev: false }));
  });
});

describe('buildSecurityHeaders', () => {
  function headerMap(headers: { key: string; value: string }[]): Map<string, string> {
    return new Map(headers.map((h) => [h.key, h.value]));
  }

  test('prodda HSTS beriladi', () => {
    const headers = headerMap(buildSecurityHeaders({ isDev: false }));
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains; preload',
    );
  });

  test('dev da HSTS berilmaydi — lokal HTTP ni brauzer bir yilga bloklab qo‘yardi', () => {
    const headers = headerMap(buildSecurityHeaders({ isDev: true }));
    expect(headers.has('Strict-Transport-Security')).toBe(false);
  });

  test('X-Frame-Options berilmaydi — u CSP frame-ancestors bilan ziddiyatga kiradi', () => {
    // `SAMEORIGIN` eski brauzerlarda Telegram Web dagi Mini App ni bloklardi.
    // Ramkalarni boshqarish yagona joyda — CSP da.
    const headers = headerMap(buildSecurityHeaders({ isDev: false }));
    expect(headers.has('X-Frame-Options')).toBe(false);
  });

  test('MIME turini taxmin qilish o‘chiriladi', () => {
    const headers = headerMap(buildSecurityHeaders({ isDev: false }));
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  test('referer boshqa saytga to‘liq yuborilmaydi', () => {
    const headers = headerMap(buildSecurityHeaders({ isDev: false }));
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  test('kamera, mikrofon va geolokatsiya so‘ralmaydi', () => {
    const headers = headerMap(buildSecurityHeaders({ isDev: false }));
    expect(headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  test('CSP sarlavhasi siyosat quruvchisi bilan bir xil', () => {
    const headers = headerMap(buildSecurityHeaders({ isDev: false }));
    expect(headers.get('Content-Security-Policy')).toBe(
      buildContentSecurityPolicy({ isDev: false }),
    );
  });
});
