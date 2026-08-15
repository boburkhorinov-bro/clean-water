import { checkProcessEnv } from '@/server/env';

/**
 * Next.js server instansi ko'tarilganda bir marta ishlaydi (§6).
 *
 * Bu yerda sozlama tekshiriladi: noto'g'ri sozlangan prod deploy birinchi
 * so'rovda emas, ko'tarilishda yiqilishi kerak — aks holda konteyner
 * «sog'lom» ko'rinadi va nosozlik faqat mijoz shikoyat qilganda ma'lum
 * bo'ladi.
 */
export function register(): void {
  // Edge runtimeda `process.env` to'liq emas va Node API si yo'q; tekshiruv
  // faqat serverda ma'noga ega.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  checkProcessEnv('web');
}
