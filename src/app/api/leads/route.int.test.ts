import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { FORM_TOKEN_MAX_AGE_MS, issueFormToken } from '@/server/form-token';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/leads` — HTTP darajasi (§4.5, §6).
 *
 * Servis qatlami alohida qoplangan; bu yerda aynan marshrutning o'z ishi
 * tekshiriladi: validatsiya, status kodlari, rate-limit, `Retry-After` va
 * spam to'siqlari.
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

const SECRET = 'test-sir-kaliti-kamida-32-belgi-uzunlikda';
process.env.JWT_SECRET = SECRET;

const { POST } = await import('./route');

/** Odam formani to'ldirishga sarflaydigan vaqt. */
function humanToken(): string {
  return issueFormToken(SECRET, Date.now() - 10_000);
}

function request(body: unknown, ip = '10.0.0.1'): Request {
  const payload = body as Record<string, unknown> | null;
  return new Request('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(
      payload && typeof payload === 'object' && !('formToken' in payload)
        ? { ...payload, formToken: humanToken() }
        : payload,
    ),
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

/**
 * Spam to'siqlari (§6). Sabab mijozga aytilmaydi va javob kodi bir xil —
 * botga qaysi to'siqqa urilgani haqida ma'lumot bermaslik kerak.
 */
describe('POST /api/leads — spam himoyasi', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test('honeypot to‘ldirilgan bo‘lsa ariza yozilmaydi', async () => {
    const response = await POST(
      request(
        { phone: '+998901234567', source: 'WEB', website: 'https://spam.example' },
        '10.20.0.1',
      ),
    );

    expect(response.status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  test('honeypot dagi bo‘shliqlar to‘ldirish hisoblanmaydi', async () => {
    // Ba'zi brauzer kengaytmalari maydonlarga bo'shliq qo'yib yuboradi;
    // buning uchun haqiqiy mijozning arizasi yo'qolmasligi kerak.
    const response = await POST(
      request({ phone: '+998901234567', source: 'WEB', website: '   ' }, '10.20.0.2'),
    );

    expect(response.status).toBe(201);
  });

  test('formani darhol yuborish rad etiladi', async () => {
    const response = await POST(
      request(
        { phone: '+998901234567', source: 'WEB', formToken: issueFormToken(SECRET, Date.now()) },
        '10.21.0.1',
      ),
    );

    expect(response.status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  test('tokensiz so‘rov rad etiladi', async () => {
    const response = await POST(
      request({ phone: '+998901234567', source: 'WEB', formToken: undefined }, '10.22.0.1'),
    );

    expect(response.status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  test('begona sir bilan imzolangan token rad etiladi', async () => {
    const response = await POST(
      request(
        {
          phone: '+998901234567',
          source: 'WEB',
          formToken: issueFormToken('boshqa-sir-kaliti-32-belgidan-uzun', Date.now() - 10_000),
        },
        '10.23.0.1',
      ),
    );

    expect(response.status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  test('eskirgan token rad etiladi', async () => {
    const response = await POST(
      request(
        {
          phone: '+998901234567',
          source: 'WEB',
          formToken: issueFormToken(SECRET, Date.now() - FORM_TOKEN_MAX_AGE_MS - 1000),
        },
        '10.24.0.1',
      ),
    );

    expect(response.status).toBe(400);
  });

  test('honeypot rad etilishi oddiy validatsiya xatosidan farq qilmaydi', async () => {
    // Bot javobga qarab honeypot borligini bilib olmasligi kerak — aks holda
    // keyingi urinishda u maydonni bo'sh qoldirardi.
    const honeypot = await POST(
      request({ phone: '+998901234567', source: 'WEB', website: 'bot' }, '10.25.0.1'),
    );
    const badPhone = await POST(request({ phone: '12345', source: 'WEB' }, '10.25.0.2'));

    expect(honeypot.status).toBe(badPhone.status);
    expect(await honeypot.json()).toEqual(await badPhone.json());
  });

  test('eskirgan forma alohida kod bilan qaytadi — mijoz uni tuzata oladi', async () => {
    // Bu holatni foydalanuvchi hal qiladi (sahifani yangilash), shuning uchun
    // klient yangi token olib qayta yuborishi uchun kodni bilishi kerak.
    const response = await POST(
      request(
        {
          phone: '+998901234567',
          source: 'WEB',
          formToken: issueFormToken(SECRET, Date.now() - FORM_TOKEN_MAX_AGE_MS - 1000),
        },
        '10.26.0.1',
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'stale_form' });
  });
});
