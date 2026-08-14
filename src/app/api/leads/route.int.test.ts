import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/leads` — HTTP darajasi (§4.5, §6).
 *
 * Servis qatlami alohida qoplangan; bu yerda aynan marshrutning o'z ishi
 * tekshiriladi: validatsiya, status kodlari, rate-limit va `Retry-After`.
 *
 * `next/headers` freymvork infratuzilmasi, bizning mantiqimiz emas — u
 * mocklanadi, qolgan hamma narsa haqiqiy bazaga qarshi ishlaydi.
 */
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

// Telegram xabarnomasi tashqi tarmoqqa chiqmasligi kerak.
vi.mock('@/server/telegram/notify-manager', () => ({
  notifyManagers: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import('./route');

function request(body: unknown, ip = '10.0.0.1'): Request {
  return new Request('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/leads', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('to‘g‘ri ariza 201 va id qaytaradi', async () => {
    const response = await POST(request({ phone: '+998901234567', source: 'WEB' }, '10.1.0.1'));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; status: string };
    expect(body.status).toBe('NEW');
    expect(await prisma.lead.count()).toBe(1);
  });

  test('JSON bo‘lmagan tana 400', async () => {
    const bad = new Request('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.2.0.1' },
      body: 'umuman json emas',
    });

    const response = await POST(bad);

    expect(response.status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  test('majburiy maydonsiz tana 400', async () => {
    const response = await POST(request({ source: 'WEB' }, '10.3.0.1'));

    expect(response.status).toBe(400);
  });

  test('notanish `source` 400', async () => {
    const response = await POST(request({ phone: '+998901234567', source: 'SMS' }, '10.4.0.1'));

    expect(response.status).toBe(400);
  });

  test('normallashmaydigan telefon 400 — 500 emas', async () => {
    const response = await POST(request({ phone: '12345', source: 'WEB' }, '10.5.0.1'));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('invalid_lead');
  });

  test('juda uzun izoh 400', async () => {
    const response = await POST(
      request({ phone: '+998901234567', source: 'WEB', comment: 'x'.repeat(1001) }, '10.6.0.1'),
    );

    expect(response.status).toBe(400);
  });

  test('limitdan oshgan so‘rov 429 va Retry-After sarlavhasi bilan qaytadi', async () => {
    const ip = '10.7.0.1';
    // Limit — soatiga 10 ta.
    for (let i = 0; i < 10; i += 1) {
      const ok = await POST(request({ phone: '+998901234567', source: 'WEB' }, ip));
      expect(ok.status).toBe(201);
    }

    const blocked = await POST(request({ phone: '+998901234567', source: 'WEB' }, ip));

    expect(blocked.status).toBe(429);
    const retryAfter = blocked.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  test('bir IP bloklansa boshqasi ta’sirlanmaydi', async () => {
    const blockedIp = '10.8.0.1';
    for (let i = 0; i < 11; i += 1) {
      await POST(request({ phone: '+998901234567', source: 'WEB' }, blockedIp));
    }

    const other = await POST(request({ phone: '+998901234567', source: 'WEB' }, '10.8.0.2'));

    expect(other.status).toBe(201);
  });

  test('mavjud bo‘lmagan mahsulot 400', async () => {
    const response = await POST(
      request(
        {
          phone: '+998901234567',
          source: 'WEB',
          productId: '00000000-0000-4000-8000-000000000000',
        },
        '10.9.0.1',
      ),
    );

    expect(response.status).toBe(400);
  });

  test('uuid bo‘lmagan productId 400 — bazaga umuman bormaydi', async () => {
    const response = await POST(
      request({ phone: '+998901234567', source: 'WEB', productId: 'uuid-emas' }, '10.10.0.1'),
    );

    expect(response.status).toBe(400);
  });
});
