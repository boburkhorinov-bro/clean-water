import { describe, expect, test } from 'vitest';
import {
  FORM_TOKEN_MAX_AGE_MS,
  FORM_TOKEN_MIN_AGE_MS,
  issueFormToken,
  verifyFormToken,
} from './form-token';

/**
 * Forma tokeni — spam himoyasining vaqt o'lchovi (§6).
 *
 * G'oya: haqiqiy odam formani bir necha soniyada to'ldiradi, bot esa sahifani
 * ochgan zahoti yuboradi. Vaqtni klientga ishonib bo'lmaydi (u shunchaki
 * boshqa sonni yuboradi), shuning uchun boshlanish payti serverda imzolanadi.
 *
 * CAPTCHA ataylab ishlatilmayapti: u har bir mijozga soliq soladi va MVP
 * uchun ortiqcha. Honeypot + vaqt o'lchovi ommaviy bot oqimini to'xtatadi.
 */

const SECRET = 'test-sir-kaliti-kamida-32-belgi-uzunlikda';
const T0 = Date.UTC(2026, 7, 15, 10, 0, 0);

describe('verifyFormToken', () => {
  test('yetarli vaqt o‘tgan token qabul qilinadi', () => {
    const token = issueFormToken(SECRET, T0);
    const result = verifyFormToken(token, SECRET, { now: T0 + 5_000 });
    expect(result).toEqual({ ok: true });
  });

  test('darhol yuborilgan forma rad etiladi', () => {
    const token = issueFormToken(SECRET, T0);
    expect(verifyFormToken(token, SECRET, { now: T0 + 200 })).toEqual({
      ok: false,
      reason: 'too_fast',
    });
  });

  test('chegara aynan minimal vaqtda ochiladi', () => {
    const token = issueFormToken(SECRET, T0);
    expect(verifyFormToken(token, SECRET, { now: T0 + FORM_TOKEN_MIN_AGE_MS })).toEqual({
      ok: true,
    });
  });

  test('juda eski token rad etiladi', () => {
    // Sahifa bir sutkadan uzoq ochiq turgan — foydalanuvchi yangilashi kerak.
    const token = issueFormToken(SECRET, T0);
    expect(verifyFormToken(token, SECRET, { now: T0 + FORM_TOKEN_MAX_AGE_MS + 1 })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  test('boshqa sir bilan imzolangan token rad etiladi', () => {
    const token = issueFormToken('boshqa-sir-kaliti-kamida-32-belgi-uzun', T0);
    expect(verifyFormToken(token, SECRET, { now: T0 + 5_000 })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('vaqtni orqaga surish imzoni buzadi', () => {
    // Bot «men bu formani bir soat oldin ochganman» deb ayta olmaydi:
    // vaqt imzoning bir qismi.
    const token = issueFormToken(SECRET, T0);
    const [, signature] = token.split('.');
    const forged = `${(T0 - 60 * 60 * 1000).toString(36)}.${signature}`;

    expect(verifyFormToken(forged, SECRET, { now: T0 + 5_000 })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('imzosi o‘zgartirilgan token rad etiladi', () => {
    const token = issueFormToken(SECRET, T0);
    const [issuedAt, signature] = token.split('.');
    const tampered = `${issuedAt}.${signature!.slice(0, -1)}${signature!.endsWith('a') ? 'b' : 'a'}`;

    expect(verifyFormToken(tampered, SECRET, { now: T0 + 5_000 })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('bo‘sh yoki buzuq token yiqilmaydi, rad etiladi', () => {
    for (const bad of ['', '   ', 'salom', 'a.b.c', '....', 'zzz.zzz']) {
      expect(verifyFormToken(bad, SECRET, { now: T0 })).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  test('token yo‘q bo‘lsa rad etiladi', () => {
    expect(verifyFormToken(undefined, SECRET, { now: T0 })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('sir sozlanmagan bo‘lsa tekshiruv o‘tmaydi', () => {
    // Ochiq qoldirish mumkin emas edi: sirsiz muhitda himoya jimgina
    // o'chib qolardi va buni hech kim sezmasdi.
    const token = issueFormToken(SECRET, T0);
    expect(verifyFormToken(token, '', { now: T0 + 5_000 })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('kelajakdan kelgan token rad etiladi', () => {
    const token = issueFormToken(SECRET, T0 + 60_000);
    expect(verifyFormToken(token, SECRET, { now: T0 })).toEqual({
      ok: false,
      reason: 'too_fast',
    });
  });
});

describe('issueFormToken', () => {
  test('token sirni oshkor qilmaydi', () => {
    const token = issueFormToken(SECRET, T0);
    expect(token).not.toContain(SECRET);
  });

  test('har bir vaqt uchun o‘z imzosi', () => {
    expect(issueFormToken(SECRET, T0)).not.toBe(issueFormToken(SECRET, T0 + 1000));
  });

  test('bir xil kirishda bir xil natija — holat saqlanmaydi', () => {
    // Token bazada ham, xotirada ham saqlanmaydi: `web` bir nechta instansda
    // ishga tushsa, bir instans bergan tokenni ikkinchisi tekshira olishi kerak.
    expect(issueFormToken(SECRET, T0)).toBe(issueFormToken(SECRET, T0));
  });
});
