import { describe, expect, test } from 'vitest';
import { resolvePoolMax } from './db-pool';

/**
 * Ulanishlar hovuzining o'lchami (§7: relizga tayyorlik).
 *
 * Yuklama tekshiruvida topildi: parallel so'rovlar PostgreSQL ning
 * `max_connections` limitini yeb qo'yadi va sahifalar 500 qaytaradi
 * («remaining connection slots are reserved for roles with the SUPERUSER
 * attribute»). Hovuz o'lchami bazaning limitiga va instanslar soniga
 * bog'liq, ya'ni uni deployda sozlash mumkin bo'lishi kerak.
 */

describe('resolvePoolMax', () => {
  test('sozlanmagan bo‘lsa maqbul standart qiymat', () => {
    expect(resolvePoolMax(undefined)).toBe(10);
  });

  test('muhitdan o‘qiydi', () => {
    expect(resolvePoolMax('25')).toBe(25);
  });

  test('son bo‘lmagan qiymat standartga tushadi', () => {
    // Xato yozilgan `.env` ilovani yiqitmasligi kerak: hovuz o'lchami
    // ishga tushishni bloklaydigan darajada muhim emas.
    expect(resolvePoolMax('ko‘p')).toBe(10);
  });

  test('nol va manfiy qiymat rad etiladi', () => {
    // `max: 0` bilan hovuz hech qachon ulanish bermaydi va ilova
    // birinchi so'rovda muzlab qolardi.
    expect(resolvePoolMax('0')).toBe(10);
    expect(resolvePoolMax('-5')).toBe(10);
  });

  test('kasr qiymat butunga keltiriladi', () => {
    expect(resolvePoolMax('7.9')).toBe(7);
  });
});
