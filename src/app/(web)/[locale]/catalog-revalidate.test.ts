import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/**
 * Katalog sahifalari keshlanadimi (§4.3, yuklama tekshiruvi).
 *
 * Mahsulot sahifalari eng ko'p ochiladigan sahifalar, lekin ular boshida
 * keshlanmasdi va har so'rov bazaga borardi: yuklama tekshiruvida ro'yxat
 * 70 RPS / p95 239 ms bergan joyda mahsulot sahifasi 11.5 RPS / p95 634 ms
 * ko'rsatdi.
 *
 * IKKALA e'lon ham kerak, va buni faqat qurilgan artefakt ko'rsatadi:
 *
 *   - yolg'iz `revalidate` bilan `.next/prerender-manifest.json` da sahifa
 *     UMUMAN yo'q edi — Next.js `generateStaticParams` siz dinamik
 *     marshrutni to'liq dinamik deb biladi;
 *   - ikkalasi bilan sahifa `dynamicRoutes` ga tushdi va ishlayotgan
 *     serverda javob `x-nextjs-cache: MISS` dan `HIT` ga o'tdi
 *     (`Cache-Control: s-maxage=60`), RPS esa 11.5 dan 40.9 ga ko'tarildi.
 *
 * Shuning uchun test ikkalasini ham talab qiladi: birini olib tashlash
 * hech narsani yiqitmaydi, sayt shunchaki jimgina sekinlashadi.
 *
 * Sahifa moduli ATAYLAB import qilinmaydi — u butun React daraxtini va
 * servis qatlamini tortib keladi va bu mashinada test chegarasidan uzoqroq
 * ketadi (CLAUDE.md — 3.8 GB). Tekshirilayotgani marshrut sozlamasi, ya'ni
 * matn darajasidagi kelishuv, xuddi `site.docker.test.ts` kabi.
 */

/** Ro'yxat sahifalari: `[locale]` uchun params allaqachon layoutda. */
const LIST_PAGES = ['filtrlar/page.tsx', 'kartrijlar/page.tsx'];

/** Mahsulot sahifalari: `[slug]` uchun params shu yerda e'lon qilinadi. */
const DETAIL_PAGES = ['filtrlar/[slug]/page.tsx', 'kartrijlar/[slug]/page.tsx'];

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('katalog sahifalari ISR bilan keshlanadi', () => {
  test.each([...LIST_PAGES, ...DETAIL_PAGES])('%s — revalidate 60', (page) => {
    expect(read(page)).toMatch(/^export const revalidate = 60;$/m);
  });

  test.each(DETAIL_PAGES)('%s — generateStaticParams ISR ni yoqadi', (page) => {
    expect(read(page)).toMatch(/export (async )?function generateStaticParams/);
  });
});
