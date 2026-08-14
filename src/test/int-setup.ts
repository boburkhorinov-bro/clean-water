import { beforeAll } from 'vitest';

/**
 * Integratsiya testlari uchun muhit.
 *
 * `DATABASE_URL` ataylab shu yerda o'rnatiladi va `cleanwater_test` ga
 * yo'naltiriladi: test ishlab chiqish bazasidagi ma'lumotni o'chirib
 * yuborishi mumkin emas.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://cleanwater:cleanwater@127.0.0.1:5432/cleanwater_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;

beforeAll(() => {
  if (!/cleanwater_test/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error(
      'Integratsiya testlari faqat `cleanwater_test` bazasida ishlashi mumkin. ' +
        `Joriy: ${process.env.DATABASE_URL}`,
    );
  }
});
