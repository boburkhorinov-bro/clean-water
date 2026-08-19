import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';

/**
 * `POST /api/my-filter/phone` — Mini App dagi telefon formasi (§4.5).
 *
 * Telegram avtorizatsiyasi telefon bermaydi, shuning uchun ilovaga birinchi
 * kirgan mijoz `phone` siz qoladi va «Almashtirishga buyurtma» tugmasi unga
 * ishlamaydi. Botdagi «Raqamni yuborish» tugmasi bu muammoni chatda hal
 * qiladi, bu marshrut esa ilovaning o'zida.
 *
 * §6: kim ekani SESSIYADAN olinadi. Klient yuborgan `telegramId` ga ishonib
 * bo'lmaydi — u bilan istalgan odam boshqa mijozning raqamini o'zgartirardi.
 */

let sessionCookie: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (sessionCookie ? { value: sessionCookie } : undefined) }),
}));

const { createSessionToken } = await import('@/server/auth/session');
const { POST } = await import('./route');

const JWT_SECRET = 'test-secret-test-secret-test-secret';

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/my-filter/phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/my-filter/phone', () => {
  beforeEach(async () => {
    await resetDatabase();
    process.env.JWT_SECRET = JWT_SECRET;
    sessionCookie = undefined;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function signIn(telegramId: bigint) {
    const user = await prisma.user.create({ data: { telegramId } });
    sessionCookie = await createSessionToken(
      { userId: user.id, telegramId: telegramId.toString(), role: 'CLIENT' },
      JWT_SECRET,
    );
    return user;
  }

  test('sessiyasiz 401', async () => {
    const response = await POST(request({ phone: '+998901234567' }));

    expect(response.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  test('raqam saqlanadi', async () => {
    const user = await signIn(555000111n);

    const response = await POST(request({ phone: '90 123 45 67' }));

    expect(response.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe(
      '+998901234567',
    );
  });

  test('yaroqsiz raqam 400 va baza o‘zgarmaydi', async () => {
    const user = await signIn(555000111n);

    const response = await POST(request({ phone: '12345' }));

    expect(response.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBeNull();
  });

  test('bo‘sh tana 400', async () => {
    await signIn(555000111n);

    expect((await POST(request({}))).status).toBe(400);
  });

  test('raqam bo‘sh bo‘lsa mijoz o‘z yozuviga yozadi', async () => {
    const user = await signIn(555000111n);

    const response = await POST(request({ phone: '+998907777777' }));

    expect(response.status).toBe(200);
    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe(
      '+998907777777',
    );
  });

  /**
   * §6: forma raqamni TASDIQLAMAYDI — mijoz uni qo'lda yozadi. Begona raqam
   * yozilsa, o'sha mijozning yozuvi (o'rnatish manzili, arizalari,
   * eslatmalari) egallanib ketmasligi kerak. 409 — so'rov to'g'ri, lekin
   * holat yo'l bermayapti; interfeys mijozga botdagi tasdiqlangan yo'lni
   * ko'rsatadi.
   */
  test('BEGONA raqam 409 va hech narsa ko‘chirilmaydi', async () => {
    const other = await prisma.user.create({
      data: { phone: '+998901234567', name: 'Boshqa mijoz' },
    });
    const filter = await prisma.product.create({
      data: { kind: 'FILTER', slug: 'osmos-2', nameUz: 'Osmos 2', nameRu: 'Осмос 2', price: '1' },
    });
    await prisma.installation.create({
      data: { userId: other.id, filterProductId: filter.id, installedAt: new Date('2026-01-10') },
    });
    const attacker = await signIn(555000111n);

    const response = await POST(request({ phone: '+998901234567' }));

    expect(response.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: attacker.id } })).phone).toBeNull();
    expect(await prisma.installation.count({ where: { userId: other.id } })).toBe(1);
    expect(await prisma.user.count()).toBe(2);
  });

  test('CRM yozuvi telegram_id siz bo‘lsa ham egallanmaydi', async () => {
    // Bu variant yanada oson edi: buzg'unchining yozuvi bo'lmasa,
    // telegram_id to'g'ridan-to'g'ri mijozning yozuviga yozilardi.
    const other = await prisma.user.create({ data: { phone: '+998901234567' } });
    // `signIn` sessiya uchun yozuv yaratadi, lekin uni o'chirib turamiz —
    // shunda faqat mijozning yozuvi qoladi.
    const session = await signIn(555000111n);
    await prisma.user.delete({ where: { id: session.id } });

    const response = await POST(request({ phone: '+998901234567' }));

    expect(response.status).toBe(409);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).telegramId,
    ).toBeNull();
  });

  test('urinishlar soni cheklanadi — forma spamdan himoyalangan', async () => {
    await signIn(555000111n);

    let lastStatus = 0;
    for (let i = 0; i < 25; i += 1) {
      lastStatus = (await POST(request({ phone: '+998901234567' }))).status;
    }

    expect(lastStatus).toBe(429);
  });
});
