import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { verifyInitData } from './telegram-init-data';

/**
 * §4.4 va §6: «Har bir so'rovda serverda Telegram `initData` ning HMAC-imzosini
 * tekshirish.» Bu — butun avtorizatsiyaning tayanchi. Bu yerdagi xato
 * istalgan odamga istalgan Telegram ID nomidan kirish imkonini beradi.
 *
 * Quyidagi yordamchi core.telegram.org/bots/webapps dagi tavsifdan mustaqil
 * yozilgan: barcha maydonlar (`hash` dan tashqari) alifbo bo'yicha saralanadi,
 * `key=value` ko'rinishida `\n` bilan qo'shiladi; maxfiy kalit —
 * HMAC_SHA256(bot_token, "WebAppData"); imzo — o'sha kalit bilan hex HMAC.
 *
 * Implementatsiya boshqa faylda mustaqil yozilgani uchun, agar u boshqacha
 * saralasa yoki boshqa ajratgich ishlatsa, testlar buni ushlaydi.
 */
function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

const BOT_TOKEN = '123456:TEST-TOKEN-abcdefghijklmnop';
const NOW = new Date('2026-08-14T09:00:00Z');

function freshFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    auth_date: String(Math.floor(NOW.getTime() / 1000)),
    query_id: 'AAH-test',
    user: JSON.stringify({ id: 555000111, first_name: 'Aziz', language_code: 'uz' }),
    ...overrides,
  };
}

describe('verifyInitData', () => {
  test('to‘g‘ri imzolangan initData qabul qilinadi va foydalanuvchi o‘qiladi', () => {
    const initData = signInitData(freshFields(), BOT_TOKEN);

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.user.id).toBe(555000111);
    expect(result.data.user.languageCode).toBe('uz');
    expect(result.data.authDate).toEqual(NOW);
  });

  test('maydon o‘zgartirilsa rad etiladi', () => {
    const initData = signInitData(freshFields(), BOT_TOKEN);
    const tampered = initData.replace('555000111', '999000222');

    const result = verifyInitData(tampered, BOT_TOKEN, { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'hash_mismatch' });
  });

  test('boshqa bot tokeni bilan imzolangan bo‘lsa rad etiladi', () => {
    const initData = signInitData(freshFields(), 'boshqa:TOKEN');

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'hash_mismatch' });
  });

  test('hash umuman bo‘lmasa rad etiladi', () => {
    const params = new URLSearchParams(freshFields());

    const result = verifyInitData(params.toString(), BOT_TOKEN, { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'missing_hash' });
  });

  test('auth_date 24 soatdan eski bo‘lsa rad etiladi (§4.4)', () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 24 * 60 * 60 - 1);
    const initData = signInitData(freshFields({ auth_date: old }), BOT_TOKEN);

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  test('auth_date roppa-rosa 24 soat oldin bo‘lsa hali qabul qilinadi', () => {
    const edge = String(Math.floor(NOW.getTime() / 1000) - 24 * 60 * 60);
    const initData = signInitData(freshFields({ auth_date: edge }), BOT_TOKEN);

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result.ok).toBe(true);
  });

  test('auth_date yo‘q bo‘lsa rad etiladi', () => {
    const fields = freshFields();
    delete fields.auth_date;
    const initData = signInitData(fields, BOT_TOKEN);

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'missing_auth_date' });
  });

  test('user maydoni buzuq JSON bo‘lsa rad etiladi, xato tashlamaydi', () => {
    const initData = signInitData(freshFields({ user: '{buzuq' }), BOT_TOKEN);

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'invalid_user' });
  });

  test('user maydoni umuman bo‘lmasa rad etiladi', () => {
    const fields = freshFields();
    delete fields.user;
    const initData = signInitData(fields, BOT_TOKEN);

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'invalid_user' });
  });

  test('bo‘sh satr rad etiladi', () => {
    const result = verifyInitData('', BOT_TOKEN, { now: NOW });

    expect(result.ok).toBe(false);
  });

  test('bot tokeni bo‘sh bo‘lsa rad etiladi — sozlama xatosi kirishga aylanmasligi kerak', () => {
    const initData = signInitData(freshFields(), '');

    const result = verifyInitData(initData, '', { now: NOW });

    expect(result).toEqual({ ok: false, reason: 'missing_bot_token' });
  });

  test('yangi `signature` maydoni bo‘lsa ham imzo to‘g‘ri hisoblanadi', () => {
    // Telegram initData ga Ed25519 `signature` qo'shdi. U `hash` hisobiga
    // KIRADI, chunki Telegram hash ni `hash` dan boshqa hamma maydon ustidan
    // hisoblaydi. Uni chiqarib tashlash barcha yangi klientlarni sindiradi.
    const initData = signInitData(freshFields({ signature: 'AbCdEf123' }), BOT_TOKEN);

    const result = verifyInitData(initData, BOT_TOKEN, { now: NOW });

    expect(result.ok).toBe(true);
  });
});
