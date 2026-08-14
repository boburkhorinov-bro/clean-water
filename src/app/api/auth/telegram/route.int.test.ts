import { createHmac } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { SESSION_COOKIE, verifySessionToken } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { POST } from './route';

/**
 * `POST /api/auth/telegram` — HTTP darajasi (§4.4).
 *
 * Imzo tekshiruvi alohida qoplangan; bu yerda marshrutning o'z ishi:
 * status kodlari, `User` upsert, cookie va uning bayroqlari.
 */

const BOT_TOKEN = '123456:TEST-TOKEN-abcdefghijklmnop';
const JWT_SECRET = 'test-secret-kamida-32-belgidan-iborat-bolishi-kerak';

function signInitData(fields: Record<string, string>, botToken = BOT_TOKEN): string {
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

function freshInitData(overrides: Record<string, string> = {}, botToken = BOT_TOKEN): string {
  return signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 555000111, first_name: 'Aziz', language_code: 'uz' }),
      ...overrides,
    },
    botToken,
  );
}

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/telegram', () => {
  beforeEach(async () => {
    await resetDatabase();
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;
    delete process.env.TELEGRAM_ADMIN_IDS;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('to‘g‘ri initData bilan foydalanuvchi yaratiladi', async () => {
    const response = await POST(request({ initData: freshInitData() }));

    expect(response.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { telegramId: 555000111n } });
    expect(user?.name).toBe('Aziz');
    expect(user?.lang).toBe('UZ');
    expect(user?.role).toBe('CLIENT');
  });

  test('sessiya cookie si o‘rnatiladi va httpOnly bo‘ladi', async () => {
    const response = await POST(request({ initData: freshInitData() }));

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(SESSION_COOKIE);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('path=/');
  });

  test('cookie dagi token o‘qiladi va rolni olib yuradi', async () => {
    const response = await POST(request({ initData: freshInitData() }));

    const raw = response.headers.get('set-cookie') ?? '';
    const token = /cw_session=([^;]+)/.exec(raw)?.[1];
    expect(token).toBeDefined();

    const session = await verifySessionToken(decodeURIComponent(token ?? ''), JWT_SECRET);
    expect(session?.telegramId).toBe('555000111');
    expect(session?.role).toBe('CLIENT');
  });

  test('ikkinchi kirishda yangi foydalanuvchi yaratilmaydi', async () => {
    await POST(request({ initData: freshInitData() }));
    await POST(request({ initData: freshInitData() }));

    expect(await prisma.user.count()).toBe(1);
  });

  test('ru tilidagi foydalanuvchi RU bilan yoziladi (§4.7)', async () => {
    const initData = freshInitData({
      user: JSON.stringify({ id: 555000222, first_name: 'Иван', language_code: 'ru' }),
    });

    await POST(request({ initData }));

    const user = await prisma.user.findUnique({ where: { telegramId: 555000222n } });
    expect(user?.lang).toBe('RU');
  });

  test('TELEGRAM_ADMIN_IDS dagi foydalanuvchi ADMIN bo‘lib kiradi (§4.4)', async () => {
    process.env.TELEGRAM_ADMIN_IDS = '555000111';

    await POST(request({ initData: freshInitData() }));

    const user = await prisma.user.findUnique({ where: { telegramId: 555000111n } });
    expect(user?.role).toBe('ADMIN');
  });

  test('boshqa token bilan imzolangan initData 401 va foydalanuvchi yaratilmaydi', async () => {
    const response = await POST(request({ initData: freshInitData({}, 'boshqa:TOKEN') }));

    expect(response.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  test('401 javobida rad etish sababi oshkor qilinmaydi', async () => {
    const response = await POST(request({ initData: freshInitData({}, 'boshqa:TOKEN') }));

    const body = (await response.json()) as { error: string };
    // Sabab hujumchiga imzoni tanlashda yordam beradi.
    expect(body.error).toBe('unauthorized');
    expect(JSON.stringify(body)).not.toContain('hash_mismatch');
  });

  test('muddati o‘tgan initData 401', async () => {
    const old = String(Math.floor(Date.now() / 1000) - 25 * 60 * 60);
    const response = await POST(request({ initData: freshInitData({ auth_date: old }) }));

    expect(response.status).toBe(401);
  });

  test('bo‘sh tana 400', async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
  });

  test('sozlama yo‘q bo‘lsa 500 — 401 emas, bu klientning aybi emas', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    const response = await POST(request({ initData: freshInitData() }));

    expect(response.status).toBe(500);
  });
});
