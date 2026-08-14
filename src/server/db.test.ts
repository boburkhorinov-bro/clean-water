import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Next.js build vaqtida har bir route modulini import qiladi (page data
 * yig'ish uchun), lekin o'shanda `DATABASE_URL` bo'lmasligi mumkin — u ish
 * vaqtidagi sir.
 *
 * Shuning uchun klient import paytida emas, birinchi murojaatda yaratilishi
 * kerak. Aks holda `npm run build` «Failed to collect page data» bilan yiqiladi.
 */
describe('prisma klienti', () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  test('DATABASE_URL yo‘q bo‘lsa ham modul import qilinadi', async () => {
    delete process.env.DATABASE_URL;

    await expect(import('./db')).resolves.toBeDefined();
  });

  test('DATABASE_URL yo‘qligida bazaga murojaat aniq xato beradi', async () => {
    delete process.env.DATABASE_URL;
    const { prisma } = await import('./db');

    expect(() => prisma.user).toThrow(/DATABASE_URL/);
  });

  test('DATABASE_URL bor bo‘lsa delegatlar mavjud bo‘ladi', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    const { prisma } = await import('./db');

    // Ulanish ochilmaydi — faqat klient qurilganini tekshiramiz.
    expect(prisma.user).toBeDefined();
  });
});
