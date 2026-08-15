import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { registerInstallation } from '@/server/services/installations';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/my-filter/replace` — «Mening filtrim» ekranidagi «Almashtirishga
 * buyurtma» tugmasi (§2, §4.6).
 *
 * Telegram tugmasi bilan bir xil servisga boradi, lekin bu yerda mijoz Mini
 * App ichida: kim ekani `callback_data` dan emas, SESSIYADAN olinadi (§6).
 */

let sessionCookie: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (sessionCookie ? { value: sessionCookie } : undefined) }),
}));

vi.mock('@/server/telegram/notify-manager', () => ({
  notifyManagers: vi.fn().mockResolvedValue(undefined),
}));

const { createSessionToken } = await import('@/server/auth/session');
const { POST } = await import('./route');

const JWT_SECRET = 'test-secret-test-secret-test-secret';

function request(body: unknown, ip = '10.0.0.1'): Request {
  return new Request('http://localhost:3000/api/my-filter/replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/my-filter/replace', () => {
  beforeEach(async () => {
    await resetDatabase();
    process.env.JWT_SECRET = JWT_SECRET;
    sessionCookie = undefined;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  let seq = 0;

  async function setupPart() {
    seq += 1;
    const user = await prisma.user.create({
      data: {
        phone: `+99890123456${seq % 10}`,
        name: 'Aziz',
        telegramId: BigInt(555000 + seq),
      },
    });
    const filter = await prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: `filtr-${seq}`,
        nameUz: 'Osmos 5',
        nameRu: 'Осмос 5',
        price: '2500000',
      },
    });
    const cartridge = await prisma.product.create({
      data: {
        kind: 'CARTRIDGE',
        slug: `kartrij-${seq}`,
        nameUz: 'Mexanik kartrij',
        nameRu: 'Механический',
        price: '150000',
        cartridgeSpec: { create: { resourceMonths: 6 } },
      },
    });
    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: new Date('2026-02-15T04:00:00Z'),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = installation.parts[0];
    if (!part) throw new Error('test sozlamasi buzilgan');

    return { user, part };
  }

  async function signIn(user: { id: string; telegramId: bigint | null }) {
    sessionCookie = await createSessionToken(
      { userId: user.id, telegramId: String(user.telegramId), role: 'CLIENT' },
      JWT_SECRET,
    );
  }

  test('SESSIYASIZ 401 — tugma faqat o‘z kartrijingga ishlaydi', async () => {
    const { part } = await setupPart();

    const response = await POST(request({ installedPartId: part.id }, '10.10.0.1'));

    expect(response.status).toBe(401);
    expect(await prisma.lead.count()).toBe(0);
  });

  test('o‘z kartriji uchun ariza yaratiladi', async () => {
    const { user, part } = await setupPart();
    await signIn(user);

    const response = await POST(request({ installedPartId: part.id }, '10.10.0.2'));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('CREATED');
    expect(await prisma.lead.count()).toBe(1);
  });

  test('BEGONA KARTRIJ 404 — boshqa mijoznikiga tegib bo‘lmaydi', async () => {
    const mine = await setupPart();
    const stranger = await setupPart();
    await signIn(mine.user);

    const response = await POST(request({ installedPartId: stranger.part.id }, '10.10.0.3'));

    expect(response.status).toBe(404);
    expect(await prisma.lead.count()).toBe(0);
  });

  test('takroriy bosish 200 va `ALREADY_REQUESTED`, ikkinchi ariza yo‘q', async () => {
    const { user, part } = await setupPart();
    await signIn(user);

    await POST(request({ installedPartId: part.id }, '10.10.0.4'));
    const second = await POST(request({ installedPartId: part.id }, '10.10.0.4'));

    expect(second.status).toBe(200);
    const body = (await second.json()) as { status: string };
    expect(body.status).toBe('ALREADY_REQUESTED');
    expect(await prisma.lead.count()).toBe(1);
  });

  test('telefonsiz mijozdan raqam so‘raladi', async () => {
    const { user, part } = await setupPart();
    await prisma.user.update({ where: { id: user.id }, data: { phone: null } });
    await signIn(user);

    const response = await POST(request({ installedPartId: part.id }, '10.10.0.5'));

    expect(response.status).toBe(422);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('PHONE_REQUIRED');
  });

  test('yaroqsiz tana 400', async () => {
    const { user } = await setupPart();
    await signIn(user);

    const response = await POST(request({ installedPartId: 'uuid emas' }, '10.10.0.6'));

    expect(response.status).toBe(400);
  });

  test('JSON bo‘lmagan tana 400', async () => {
    const { user } = await setupPart();
    await signIn(user);

    const bad = new Request('http://localhost:3000/api/my-filter/replace', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.10.0.7' },
      body: 'json emas',
    });

    expect((await POST(bad)).status).toBe(400);
  });

  test('RATE-LIMIT: ketma-ket bosishlar to‘xtatiladi (§6)', async () => {
    const { user } = await setupPart();
    await signIn(user);

    let last = 0;
    for (let i = 0; i < 25; i += 1) {
      last = (await POST(request({ installedPartId: crypto.randomUUID() }, '10.10.9.9'))).status;
    }

    expect(last).toBe(429);
  });
});
