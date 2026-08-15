import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/admin/products` — HTTP darajasi (§6).
 *
 * Servis qatlami alohida qoplangan; bu yerda aynan marshrutning o'z ishi:
 * ROL TEKSHIRUVI, validatsiya va status kodlari.
 *
 * Rol tekshiruvi eng muhimi: klientdagi admin tumbleri hech qanday huquq
 * bermaydi, hamma narsa serverda hal bo'ladi. Va begonaga 403 emas, 404
 * qaytadi — panel mavjudligini bildirmaslik uchun (layout dagi qoida bilan
 * bir xil).
 */

let sessionCookie: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (sessionCookie ? { value: sessionCookie } : undefined) }),
}));

const { createSessionToken } = await import('@/server/auth/session');
const { POST } = await import('./route');

const JWT_SECRET = 'test-secret-test-secret-test-secret';

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validProduct = {
  kind: 'FILTER',
  slug: 'osmos-5',
  nameUz: 'Osmos 5',
  nameRu: 'Осмос 5',
  price: '2500000',
};

describe('POST /api/admin/products', () => {
  beforeEach(async () => {
    await resetDatabase();
    process.env.JWT_SECRET = JWT_SECRET;
    sessionCookie = undefined;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function signIn(role: 'ADMIN' | 'CLIENT') {
    const user = await prisma.user.create({
      data: { telegramId: role === 'ADMIN' ? 111000111n : 222000222n, role },
    });
    sessionCookie = await createSessionToken(
      { userId: user.id, telegramId: String(user.telegramId), role },
      JWT_SECRET,
    );
    return user;
  }

  test('SESSIYASIZ 404 — panel mavjudligi bildirilmaydi', async () => {
    const response = await POST(request(validProduct));

    expect(response.status).toBe(404);
    expect(await prisma.product.count()).toBe(0);
  });

  test('ODDIY MIJOZ 404 — klientdagi tumbler huquq bermaydi', async () => {
    await signIn('CLIENT');

    const response = await POST(request(validProduct));

    expect(response.status).toBe(404);
    expect(await prisma.product.count()).toBe(0);
  });

  test('admin mahsulot yaratadi', async () => {
    await signIn('ADMIN');

    const response = await POST(request(validProduct));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string };
    expect(body.id).toBeTruthy();
    expect(await prisma.product.count()).toBe(1);
  });

  test('AUDIT: yaratuvchi admin jurnalga tushadi', async () => {
    const admin = await signIn('ADMIN');

    await POST(request(validProduct));

    const log = await prisma.auditLog.findFirstOrThrow();
    expect(log.adminId).toBe(admin.id);
    expect(log.action).toBe('product.create');
  });

  test('yaroqsiz mahsulot 400 va sabab bilan', async () => {
    await signIn('ADMIN');

    const response = await POST(request({ ...validProduct, kind: 'CARTRIDGE' }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; message?: string };
    expect(body.error).toBe('invalid_product');
    // Admin nima noto'g'ri ekanini ko'rishi kerak — bu ichki sir emas.
    expect(body.message).toContain('resurs');
    expect(await prisma.product.count()).toBe(0);
  });

  test('JSON bo‘lmagan tana 400', async () => {
    await signIn('ADMIN');

    const bad = new Request('http://localhost:3000/api/admin/products', {
      method: 'POST',
      body: 'json emas',
    });

    expect((await POST(bad)).status).toBe(400);
  });

  test('takroriy slug 400', async () => {
    await signIn('ADMIN');
    await POST(request(validProduct));

    const response = await POST(request(validProduct));

    expect(response.status).toBe(400);
    expect(await prisma.product.count()).toBe(1);
  });
});
