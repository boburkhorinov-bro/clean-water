import { describe, expect, test } from 'vitest';
import { isBootstrapAdmin, parseAdminIds } from './admin-allowlist';

/**
 * §4.4: «Birlamchi adminlar `TELEGRAM_ADMIN_IDS` muhit o'zgaruvchisi bilan
 * beriladi... Huquqlar har bir so'rovda Telegram ID oq ro'yxati bo'yicha
 * tekshiriladi.» §3: «Klientdagi ko'rinuvchanlik — himoya emas.»
 *
 * Bu yerdagi xatoning ikkita yo'nalishi bor va ikkalasi ham qimmat:
 * juda keng — begona odam admin bo'ladi; juda tor — egasi o'z paneliga
 * kira olmaydi.
 */
describe('parseAdminIds', () => {
  test('vergul bilan ajratilgan ID larni o‘qiydi', () => {
    expect(parseAdminIds('111,222,333')).toEqual([111n, 222n, 333n]);
  });

  test('bo‘shliqlar va yakuniy vergulga chidamli', () => {
    expect(parseAdminIds(' 111 , 222 , ')).toEqual([111n, 222n]);
  });

  test('o‘zgaruvchi berilmagan bo‘lsa bo‘sh ro‘yxat — hech kim admin emas', () => {
    expect(parseAdminIds(undefined)).toEqual([]);
    expect(parseAdminIds('')).toEqual([]);
    expect(parseAdminIds('   ')).toEqual([]);
  });

  test('raqam bo‘lmagan qiymatlar tashlab yuboriladi', () => {
    expect(parseAdminIds('111,admin,222')).toEqual([111n, 222n]);
  });

  test('takrorlangan ID lar bir marta qoladi', () => {
    expect(parseAdminIds('111,111,222')).toEqual([111n, 222n]);
  });

  test('Number aniqligidan katta Telegram ID lar buzilmaydi', () => {
    // Telegram ID lari 2^53 dan oshishi mumkin — `number` da yaxlitlanadi.
    expect(parseAdminIds('9007199254740993')).toEqual([9007199254740993n]);
  });

  test('manfiy va nol ID lar rad etiladi', () => {
    expect(parseAdminIds('-111,0,222')).toEqual([222n]);
  });
});

describe('isBootstrapAdmin', () => {
  test('ro‘yxatdagi ID admin', () => {
    expect(isBootstrapAdmin(222n, '111,222')).toBe(true);
  });

  test('ro‘yxatda yo‘q ID admin emas', () => {
    expect(isBootstrapAdmin(333n, '111,222')).toBe(false);
  });

  test('ro‘yxat bo‘sh bo‘lsa hech kim admin emas', () => {
    expect(isBootstrapAdmin(111n, '')).toBe(false);
    expect(isBootstrapAdmin(111n, undefined)).toBe(false);
  });

  test('ID satr ko‘rinishida kelsa ham to‘g‘ri solishtiriladi', () => {
    expect(isBootstrapAdmin('222', '111,222')).toBe(true);
  });

  test('yaroqsiz ID rad etiladi, xato tashlamaydi', () => {
    expect(isBootstrapAdmin('admin', '111,222')).toBe(false);
  });
});
