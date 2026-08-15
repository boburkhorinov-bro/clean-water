import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { registerInstallation } from '@/server/services/installations';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/admin/parts/[id]/replace` — kartrij almashtirilganini belgilash
 * (§7 dagi 6-band).
 */

let sessionCookie: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (sessionCookie ? { value: sessionCookie } : undefined) }),
}));

const { createSessionToken } = await import('@/server/auth/session');
const { POST } = await import('./route');

const JWT_SECRET = 'test-secret-test-secret-test-secret';

function request(id: string, body: unknown) {
  return {
    request: new Request(`http://localhost:3000/api/admin/parts/${id}/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

describe('POST /api/admin/parts/[id]/replace', () => {
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

  async function setupPart() {
    const client = await prisma.user.create({ data: { phone: '+998901234567' } });
    const filter = await prisma.product.create({
      data: { kind: 'FILTER', slug: 'osmos-5', nameUz: 'Osmos', nameRu: 'Осмос', price: '100' },
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
    const installation = await registerInstallation({
      userId: client.id,
      filterProductId: filter.id,
      installedAt: new Date('2026-02-14T19:00:00Z'),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = installation.parts[0];
    if (!part) throw new Error('test sozlamasi buzilgan');
    return part;
  }

  test('SESSIYASIZ 404', async () => {
    const part = await setupPart();
    const { request: req, context } = request(part.id, { replacedAt: '2026-08-20' });

    expect((await POST(req, context)).status).toBe(404);

    const stored = await prisma.installedPart.findUniqueOrThrow({ where: { id: part.id } });
    expect(stored.replacedAt).toBeNull();
  });

  test('ODDIY MIJOZ 404 — almashtirishni faqat menejer belgilaydi', async () => {
    await signIn('CLIENT');
    const part = await setupPart();
    const { request: req, context } = request(part.id, { replacedAt: '2026-08-20' });

    expect((await POST(req, context)).status).toBe(404);
  });

  test('admin almashtirishni belgilaydi va YANGI muddat hisoblanadi', async () => {
    await signIn('ADMIN');
    const part = await setupPart();
    const { request: req, context } = request(part.id, { replacedAt: '2026-08-20' });

    const response = await POST(req, context);

    expect(response.status).toBe(201);
    const old = await prisma.installedPart.findUniqueOrThrow({ where: { id: part.id } });
    expect(old.replacedAt).not.toBeNull();

    // 20-avgust + 6 oy = 20-fevral (Toshkent).
    const next = await prisma.installedPart.findFirstOrThrow({ where: { replacedAt: null } });
    expect(next.dueAt.toISOString()).toBe('2027-02-19T19:00:00.000Z');
  });

  test('AUDIT: almashtirish jurnalga tushadi', async () => {
    const admin = await signIn('ADMIN');
    const part = await setupPart();
    const { request: req, context } = request(part.id, { replacedAt: '2026-08-20' });

    await POST(req, context);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'part.replace' } });
    expect(log.adminId).toBe(admin.id);
    expect(log.entity).toBe(`InstalledPart:${part.id}`);
  });

  test('IKKINCHI MARTA 400 — kartrij allaqachon almashtirilgan', async () => {
    await signIn('ADMIN');
    const part = await setupPart();
    const first = request(part.id, { replacedAt: '2026-08-20' });
    await POST(first.request, first.context);

    const second = request(part.id, { replacedAt: '2026-09-01' });
    expect((await POST(second.request, second.context)).status).toBe(400);

    expect(await prisma.installedPart.count()).toBe(2);
  });

  test('yaroqsiz sana 400', async () => {
    await signIn('ADMIN');
    const part = await setupPart();
    const { request: req, context } = request(part.id, { replacedAt: 'sana emas' });

    expect((await POST(req, context)).status).toBe(400);
  });
});
