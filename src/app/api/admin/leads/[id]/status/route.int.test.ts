import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/admin/leads/[id]/status` — ariza statusini yuritish (§4.5, §6).
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
    request: new Request(`http://localhost:3000/api/admin/leads/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

describe('POST /api/admin/leads/[id]/status', () => {
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

  async function createLead() {
    return prisma.lead.create({
      data: { phone: '+998901234567', source: 'WEB', status: 'NEW' },
    });
  }

  test('SESSIYASIZ 404', async () => {
    const lead = await createLead();
    const { request: req, context } = request(lead.id, { status: 'IN_WORK' });

    expect((await POST(req, context)).status).toBe(404);

    const stored = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(stored.status).toBe('NEW');
  });

  test('ODDIY MIJOZ 404 — o‘z arizasining statusini ham o‘zgartira olmaydi', async () => {
    await signIn('CLIENT');
    const lead = await createLead();
    const { request: req, context } = request(lead.id, { status: 'DONE' });

    expect((await POST(req, context)).status).toBe(404);
  });

  test('admin statusni o‘zgartiradi', async () => {
    await signIn('ADMIN');
    const lead = await createLead();
    const { request: req, context } = request(lead.id, { status: 'IN_WORK' });

    const response = await POST(req, context);

    expect(response.status).toBe(200);
    const stored = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(stored.status).toBe('IN_WORK');
  });

  test('TAQIQLANGAN O‘TISH 409 — bu klient xatosi emas, holat ziddiyati', async () => {
    await signIn('ADMIN');
    const lead = await createLead();
    const { request: req, context } = request(lead.id, { status: 'DONE' });

    const response = await POST(req, context);

    expect(response.status).toBe(409);
    const stored = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(stored.status).toBe('NEW');
  });

  test('notanish status 400', async () => {
    await signIn('ADMIN');
    const lead = await createLead();
    const { request: req, context } = request(lead.id, { status: 'BOSHQA' });

    expect((await POST(req, context)).status).toBe(400);
  });

  test('menejer izohi jurnalga tushadi', async () => {
    await signIn('ADMIN');
    const lead = await createLead();
    const { request: req, context } = request(lead.id, {
      status: 'REJECTED',
      note: 'Mijoz javob bermadi',
    });

    await POST(req, context);

    const log = await prisma.auditLog.findFirstOrThrow();
    expect(log.payload).toMatchObject({ note: 'Mijoz javob bermadi' });
  });
});
