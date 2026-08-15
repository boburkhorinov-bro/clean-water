import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/admin/installations` — o'rnatishni qayd qilish (§7 dagi 6-band).
 *
 * CRM ning kirish nuqtasi: usta o'rnatib kelgach, menejer shu forma orqali
 * kartrijlarni yozadi va aynan shundan keyin eslatmalar ishlay boshlaydi.
 */

let sessionCookie: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (sessionCookie ? { value: sessionCookie } : undefined) }),
}));

const { createSessionToken } = await import('@/server/auth/session');
const { POST } = await import('./route');

const JWT_SECRET = 'test-secret-test-secret-test-secret';

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/installations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/installations', () => {
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

  async function fixtures() {
    const client = await prisma.user.create({
      data: { phone: '+998901234567', name: 'Aziz' },
    });
    const filter = await prisma.product.create({
      data: { kind: 'FILTER', slug: 'osmos-5', nameUz: 'Osmos 5', nameRu: 'Осмос', price: '100' },
    });
    const cartridge = await prisma.product.create({
      data: {
        kind: 'CARTRIDGE',
        slug: 'mexanika',
        nameUz: 'Mexanika',
        nameRu: 'Механика',
        price: '10',
        cartridgeSpec: { create: { resourceMonths: 6 } },
      },
    });
    return { client, filter, cartridge };
  }

  test('SESSIYASIZ 404', async () => {
    const { client, filter } = await fixtures();

    const response = await POST(
      request({
        userId: client.id,
        filterProductId: filter.id,
        installedAt: '2026-02-15',
        parts: [],
      }),
    );

    expect(response.status).toBe(404);
    expect(await prisma.installation.count()).toBe(0);
  });

  test('ODDIY MIJOZ 404 — o‘ziga o‘rnatish yoza olmaydi', async () => {
    await signIn('CLIENT');
    const { client, filter } = await fixtures();

    const response = await POST(
      request({
        userId: client.id,
        filterProductId: filter.id,
        installedAt: '2026-02-15',
        parts: [],
      }),
    );

    expect(response.status).toBe(404);
  });

  test('admin o‘rnatishni kartrijlar bilan yozadi va DUE_AT hisoblanadi', async () => {
    await signIn('ADMIN');
    const { client, filter, cartridge } = await fixtures();

    const response = await POST(
      request({
        userId: client.id,
        filterProductId: filter.id,
        installedAt: '2026-02-15',
        address: 'Toshkent, Chilonzor',
        parts: [{ cartridgeProductId: cartridge.id }],
      }),
    );

    expect(response.status).toBe(201);
    const part = await prisma.installedPart.findFirstOrThrow();
    // 15-fevral + 6 oy = 15-avgust (Toshkent kalendari bo'yicha).
    expect(part.dueAt.toISOString()).toBe('2026-08-14T19:00:00.000Z');
  });

  test('AUDIT: o‘rnatish jurnalga tushadi', async () => {
    const admin = await signIn('ADMIN');
    const { client, filter } = await fixtures();

    await POST(
      request({
        userId: client.id,
        filterProductId: filter.id,
        installedAt: '2026-02-15',
        parts: [],
      }),
    );

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'installation.create' },
    });
    expect(log.adminId).toBe(admin.id);
  });

  test('RESURSSIZ KARTRIJ 400 va o‘rnatish yozilmaydi', async () => {
    await signIn('ADMIN');
    const { client, filter } = await fixtures();
    const noSpec = await prisma.product.create({
      data: { kind: 'CARTRIDGE', slug: 'nomalum', nameUz: 'N', nameRu: 'N', price: '1' },
    });

    const response = await POST(
      request({
        userId: client.id,
        filterProductId: filter.id,
        installedAt: '2026-02-15',
        parts: [{ cartridgeProductId: noSpec.id }],
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.installation.count()).toBe(0);
  });

  test('yaroqsiz sana 400', async () => {
    await signIn('ADMIN');
    const { client, filter } = await fixtures();

    const response = await POST(
      request({
        userId: client.id,
        filterProductId: filter.id,
        installedAt: 'sana emas',
        parts: [],
      }),
    );

    expect(response.status).toBe(400);
  });
});
