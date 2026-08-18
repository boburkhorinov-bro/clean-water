import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Next.js build vaqtida har bir route modulini import qiladi (page data
 * yig'ish uchun), lekin o'shanda `DATABASE_URL` bo'lmasligi mumkin — u ish
 * vaqtidagi sir.
 *
 * Shuning uchun klient import paytida emas, birinchi murojaatda yaratilishi
 * kerak. Aks holda `npm run build` «Failed to collect page data» bilan yiqiladi.
 */
// Har bir testda `vi.resetModules()` ishlaydi, ya'ni generatsiya qilingan
// Prisma klienti QAYTA import qilinadi. Bu mashinada (3.8 GB, CLAUDE.md) u
// standart 5 soniyadan oshib ketishi mumkin va test yolg'on yiqiladi.
// Bu yerdagi da'vo import TEZLIGI emas, import BO'LISHI haqida.
vi.setConfig({ testTimeout: 30_000 });

describe('prisma klienti', () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    // `vi.resetModules()` modulni qayta yuklaydi, lekin `globalThis` ni
    // tozalamaydi: oldingi testda saqlangan klient keyingisiga o'tib
    // ketardi va test tekshirmoqchi bo'lgan xatti-harakatni yashirardi.
    delete (globalThis as { prisma?: unknown }).prisma;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
    // `NODE_ENV` tip e'lonida faqat o'qish uchun — vitest o'z API si bilan
    // uni vaqtincha almashtiradi.
    vi.unstubAllEnvs();
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

  test('prod rejimida klient qayta ishlatiladi', async () => {
    // Yuklama tekshiruvida topildi: prodda har murojaatda YANGI klient
    // qurilardi va har biri o'z ulanishlar hovuzini ochardi. Natijada
    // bir necha parallel so'rov PostgreSQL ning `max_connections` ini
    // yeb qo'yib, sahifalar 500 qaytardi.
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    vi.stubEnv('NODE_ENV', 'production');
    const { prisma } = await import('./db');

    expect(prisma.user).toBe(prisma.user);
  });

  test('dev rejimida ham klient qayta ishlatiladi', async () => {
    // Dev da global kesh HMR uchun kerak: har hot-reload da yangi hovuz
    // ochilsa, bir necha tahrirdan keyin baza ulanishlarini tugatardi.
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    vi.stubEnv('NODE_ENV', 'development');
    const { prisma } = await import('./db');

    expect(prisma.product).toBe(prisma.product);
  });
});
