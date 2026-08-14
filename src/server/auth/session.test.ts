import { describe, expect, test } from 'vitest';
import { SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from './session';

/**
 * §4.4: «JWT httpOnly + Secure + SameSite cookie ga.»
 * §4.10: «Bekor qilish qisqa amal muddati bilan hal qilinadi» — ya'ni MB da
 * sessiya jadvali yo'q, shuning uchun muddat va imzo yagona himoya.
 *
 * Bu yerdagi xato — istalgan odam o'ziga ADMIN roli yozilgan token yasay olishi.
 */
const SECRET = 'test-secret-kamida-32-belgidan-iborat-bolishi-kerak';
const NOW = new Date('2026-08-14T09:00:00Z');

const payload = {
  userId: '2f1c9d6e-0000-4000-8000-000000000001',
  telegramId: '555000111',
  role: 'CLIENT' as const,
};

describe('session token', () => {
  test('yaratilgan token o‘qiladi va mazmuni saqlanadi', async () => {
    const token = await createSessionToken(payload, SECRET, { now: NOW });

    const result = await verifySessionToken(token, SECRET, { now: NOW });

    expect(result).toMatchObject(payload);
  });

  test('boshqa kalit bilan tekshirilsa rad etiladi', async () => {
    const token = await createSessionToken(payload, SECRET, { now: NOW });

    const result = await verifySessionToken(token, 'boshqa-secret-kamida-32-belgi-uzunlikda-xxx', {
      now: NOW,
    });

    expect(result).toBeNull();
  });

  test('token o‘zgartirilsa rad etiladi', async () => {
    const token = await createSessionToken(payload, SECRET, { now: NOW });
    const [header, body, signature] = token.split('.');
    const tamperedBody = Buffer.from(
      JSON.stringify({ ...payload, role: 'ADMIN' }),
      'utf8',
    ).toString('base64url');

    const result = await verifySessionToken(`${header}.${tamperedBody}.${signature}`, SECRET, {
      now: NOW,
    });

    expect(result).toBeNull();
    expect(body).not.toBe(tamperedBody);
  });

  test('muddati o‘tgan token rad etiladi', async () => {
    const token = await createSessionToken(payload, SECRET, { now: NOW });
    const later = new Date(NOW.getTime() + (SESSION_TTL_SECONDS + 60) * 1000);

    const result = await verifySessionToken(token, SECRET, { now: later });

    expect(result).toBeNull();
  });

  test('muddat tugashiga bir daqiqa qolganda hali ishlaydi', async () => {
    const token = await createSessionToken(payload, SECRET, { now: NOW });
    const almost = new Date(NOW.getTime() + (SESSION_TTL_SECONDS - 60) * 1000);

    const result = await verifySessionToken(token, SECRET, { now: almost });

    expect(result).toMatchObject(payload);
  });

  test('ma’nosiz satr rad etiladi, xato tashlamaydi', async () => {
    await expect(verifySessionToken('umuman-token-emas', SECRET, { now: NOW })).resolves.toBeNull();
  });

  test('ADMIN roli saqlanadi va o‘qiladi', async () => {
    const token = await createSessionToken({ ...payload, role: 'ADMIN' }, SECRET, { now: NOW });

    const result = await verifySessionToken(token, SECRET, { now: NOW });

    expect(result?.role).toBe('ADMIN');
  });

  test('notanish rol qiymati bo‘lgan token rad etiladi', async () => {
    // Imzo to'g'ri bo'lsa ham, kutilmagan mazmun ishonchli emas.
    const token = await createSessionToken(
      { ...payload, role: 'SUPERADMIN' as unknown as 'ADMIN' },
      SECRET,
      { now: NOW },
    );

    const result = await verifySessionToken(token, SECRET, { now: NOW });

    expect(result).toBeNull();
  });

  test('bo‘sh kalit bilan token yaratib bo‘lmaydi — sozlama xatosi ochiq eshik emas', async () => {
    await expect(createSessionToken(payload, '', { now: NOW })).rejects.toThrow();
  });

  test('bo‘sh kalit bilan tekshiruv rad etiladi', async () => {
    const token = await createSessionToken(payload, SECRET, { now: NOW });

    await expect(verifySessionToken(token, '', { now: NOW })).resolves.toBeNull();
  });
});
