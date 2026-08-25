import { describe, expect, test } from 'vitest';
import { verifyInitData } from '@/server/auth/telegram-init-data';
import { assertLocalTarget, buildInitData, pickAdminId } from './dev-login';

/**
 * `dev-login.ts` lokal ishlab chiqishda admin sessiyasini olish uchun
 * `initData` yasaydi — Telegram klienti yasagani bilan bir xil imzo bilan.
 *
 * Shuning uchun test SKRIPTNING O'ZINI emas, uning chiqishini ILOVANING
 * haqiqiy tekshiruvchisiga (`verifyInitData`) berib sinaydi: imzo formati
 * o'zgarsa, bu yerda ko'rinadi.
 */

const BOT_TOKEN = '1234567:AAH-test-token-for-unit-tests-only';

describe('buildInitData', () => {
  test('ilovaning tekshiruvchisi qabul qiladi', () => {
    const initData = buildInitData({ botToken: BOT_TOKEN, telegramId: 1690874782 });

    const result = verifyInitData(initData, BOT_TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.user.id).toBe(1690874782);
  });

  test('boshqa token bilan rad etiladi — imzo haqiqiy tokenga bog‘langan', () => {
    const initData = buildInitData({ botToken: BOT_TOKEN, telegramId: 1690874782 });

    const result = verifyInitData(initData, '7654321:BBH-another-token');

    expect(result).toEqual({ ok: false, reason: 'hash_mismatch' });
  });

  test('`auth_date` — hozirgi vaqt, ya‘ni sessiya darhol ishlaydi', () => {
    const now = new Date('2026-08-25T09:00:00Z');

    const initData = buildInitData({ botToken: BOT_TOKEN, telegramId: 42, now });

    const result = verifyInitData(initData, BOT_TOKEN, { now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.authDate).toEqual(now);
  });

  test('24 soatdan eski `initData` ilova tomonidan rad etiladi', () => {
    const issued = new Date('2026-08-24T08:00:00Z');
    const initData = buildInitData({ botToken: BOT_TOKEN, telegramId: 42, now: issued });

    const result = verifyInitData(initData, BOT_TOKEN, {
      now: new Date('2026-08-25T09:00:00Z'),
    });

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('pickAdminId', () => {
  test('birinchi ID ni oladi — `TELEGRAM_ADMIN_IDS` vergul bilan yoziladi', () => {
    expect(pickAdminId('1690874782,111000111')).toBe(1690874782);
  });

  test('bo‘shliqlar bilan yozilgani ham ishlaydi', () => {
    expect(pickAdminId(' 1690874782 , 111000111 ')).toBe(1690874782);
  });

  test('bo‘sh qiymatda tushunarli xato — bo‘sh env = hech kim admin emas', () => {
    expect(() => pickAdminId('')).toThrow(/TELEGRAM_ADMIN_IDS/);
    expect(() => pickAdminId(undefined)).toThrow(/TELEGRAM_ADMIN_IDS/);
  });

  test('raqam bo‘lmagan qiymat jimgina NaN ga aylanmaydi', () => {
    expect(() => pickAdminId('admin')).toThrow(/TELEGRAM_ADMIN_IDS/);
  });
});

describe('assertLocalTarget', () => {
  /**
   * Skript amaldagi ADMIN sessiyasini yasaydi. U prod manzilga qaratilsa,
   * terminalda ishlaydigan admin kaliti paydo bo'lardi — shuning uchun
   * lokal bo'lmagan host butunlay taqiqlanadi.
   */
  test('lokal manzillarga ruxsat', () => {
    expect(() => assertLocalTarget('http://localhost:3000')).not.toThrow();
    expect(() => assertLocalTarget('http://127.0.0.1:3000')).not.toThrow();
  });

  test('tashqi manzil rad etiladi', () => {
    expect(() => assertLocalTarget('https://cleanwater.uz')).toThrow(/lokal/i);
    expect(() => assertLocalTarget('https://localhost.evil.com')).toThrow(/lokal/i);
  });

  test('buzuq manzil rad etiladi', () => {
    expect(() => assertLocalTarget('emas-manzil')).toThrow(/lokal/i);
  });
});
