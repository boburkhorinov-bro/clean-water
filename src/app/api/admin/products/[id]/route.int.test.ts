import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `PATCH /api/admin/products/[id]` — tahrirlash va arxivlash (§6).
 */

let sessionCookie: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (sessionCookie ? { value: sessionCookie } : undefined) }),
}));

const { createSessionToken } = await import('@/server/auth/session');
const { PATCH } = await import('./route');

const JWT_SECRET = 'test-secret-test-secret-test-secret';

function request(id: string, body: unknown) {
  return {
    request: new Request(`http://localhost:3000/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

describe('PATCH /api/admin/products/[id]', () => {
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

  async function createProduct() {
    return prisma.product.create({
      data: { kind: 'FILTER', slug: 'osmos-5', nameUz: 'Osmos 5', nameRu: 'Осмос 5', price: '100' },
    });
  }

  test('SESSIYASIZ 404', async () => {
    const product = await createProduct();
    const { request: req, context } = request(product.id, { nameUz: 'Yangi' });

    expect((await PATCH(req, context)).status).toBe(404);
  });

  test('ODDIY MIJOZ 404', async () => {
    await signIn('CLIENT');
    const product = await createProduct();
    const { request: req, context } = request(product.id, { nameUz: 'Yangi' });

    expect((await PATCH(req, context)).status).toBe(404);

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stored.nameUz).toBe('Osmos 5');
  });

  test('admin nomni yangilaydi', async () => {
    await signIn('ADMIN');
    const product = await createProduct();
    const { request: req, context } = request(product.id, { nameUz: 'Yangi nom' });

    expect((await PATCH(req, context)).status).toBe(200);

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stored.nameUz).toBe('Yangi nom');
  });

  test('ARXIVLASH: `isActive` orqali', async () => {
    await signIn('ADMIN');
    const product = await createProduct();
    const { request: req, context } = request(product.id, { isActive: false });

    expect((await PATCH(req, context)).status).toBe(200);

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stored.isActive).toBe(false);
    // Arxivlash o'chirish emas: bog'liq tarix buzilmasligi kerak.
    expect(await prisma.product.count()).toBe(1);
  });

  test('AUDIT: arxivlash alohida harakat sifatida yoziladi', async () => {
    await signIn('ADMIN');
    const product = await createProduct();
    const { request: req, context } = request(product.id, { isActive: false });

    await PATCH(req, context);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'product.archive' } });
    expect(log.entity).toBe(`Product:${product.id}`);
  });

  test('mavjud bo‘lmagan mahsulot 400', async () => {
    await signIn('ADMIN');
    const { request: req, context } = request('00000000-0000-0000-0000-000000000000', {
      nameUz: 'x',
    });

    expect((await PATCH(req, context)).status).toBe(400);
  });

  test('yaroqsiz kontent-blok 400 va mahsulot o‘zgarmaydi', async () => {
    await signIn('ADMIN');
    const product = await createProduct();
    const { request: req, context } = request(product.id, {
      contentBlocks: [{ type: 'image', src: 'https://tashqi.example/a.jpg', alt: {} }],
    });

    expect((await PATCH(req, context)).status).toBe(400);

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stored.contentBlocks).toEqual([]);
  });
});
