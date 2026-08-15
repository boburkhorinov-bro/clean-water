import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { registerInstallation } from './installations';
import { requestReplacement } from './replacement-request';

/**
 * §4.6, 3-qadam: «"Almashtirishga buyurtma" tugmasi bilan xabar yuboradi
 * (katalogdan o'tmasdan, darhol ariza yaratadi)».
 *
 * Xavfsizlik jihati: `installed_part_id` tugmaning `callback_data` sida
 * ketadi, ya'ni uni istalgan odam qo'lda yasab yuborishi mumkin. Shuning
 * uchun egalik SERVERDA tekshiriladi (§6) — aks holda begona odam boshqa
 * mijoz nomidan ariza yaratardi.
 */
describe('requestReplacement', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function tashkent(iso: string): Date {
    return new Date(`${iso}+05:00`);
  }

  let seq = 0;
  beforeEach(() => {
    seq = 0;
  });

  async function setupPart(options: { telegramId?: bigint | null; phone?: string | null } = {}) {
    seq += 1;
    const user = await prisma.user.create({
      data: {
        phone: options.phone === null ? null : (options.phone ?? `+99890123456${seq}`),
        name: 'Aziz',
        telegramId:
          options.telegramId === null ? null : (options.telegramId ?? BigInt(555000 + seq)),
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
        nameRu: 'Механический картридж',
        price: '150000',
        cartridgeSpec: { create: { resourceMonths: 6 } },
      },
    });

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-02-15T09:00:00'),
      address: 'Toshkent, Chilonzor 12',
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = installation.parts[0];
    if (!part) throw new Error('test sozlamasi buzilgan');

    return { user, filter, cartridge, part };
  }

  test('tugma bosilganda ariza darhol yaratiladi', async () => {
    const { user, cartridge, part } = await setupPart();

    const result = await requestReplacement({
      installedPartId: part.id,
      telegramId: user.telegramId ?? 0n,
    });

    expect(result.status).toBe('CREATED');
    const leads = await prisma.lead.findMany();
    expect(leads).toHaveLength(1);
    expect(leads[0]?.productId).toBe(cartridge.id);
    expect(leads[0]?.userId).toBe(user.id);
    expect(leads[0]?.status).toBe('NEW');
    expect(leads[0]?.source).toBe('MINIAPP');
  });

  test('arizada mijozning telefoni bo‘ladi — menejer qo‘ng‘iroq qiladi', async () => {
    const { user, part } = await setupPart({ phone: '+998901112233' });

    await requestReplacement({ installedPartId: part.id, telegramId: user.telegramId ?? 0n });

    const lead = await prisma.lead.findFirstOrThrow();
    expect(lead.phone).toBe('+998901112233');
  });

  test('izohda o‘rnatish manzili bo‘ladi — usta qayerga borishini bilishi kerak', async () => {
    const { user, part } = await setupPart();

    await requestReplacement({ installedPartId: part.id, telegramId: user.telegramId ?? 0n });

    const lead = await prisma.lead.findFirstOrThrow();
    expect(lead.comment).toContain('Toshkent, Chilonzor 12');
  });

  test('BEGONA KARTRIJ: boshqa mijozning kartriji uchun ariza yaratilmaydi', async () => {
    const mine = await setupPart();
    const stranger = await setupPart();

    const result = await requestReplacement({
      installedPartId: stranger.part.id,
      telegramId: mine.user.telegramId ?? 0n,
    });

    expect(result.status).toBe('NOT_FOUND');
    expect(await prisma.lead.count()).toBe(0);
  });

  test('mavjud bo‘lmagan kartrij uchun ariza yaratilmaydi', async () => {
    const { user } = await setupPart();

    const result = await requestReplacement({
      installedPartId: '00000000-0000-0000-0000-000000000000',
      telegramId: user.telegramId ?? 0n,
    });

    expect(result.status).toBe('NOT_FOUND');
    expect(await prisma.lead.count()).toBe(0);
  });

  test('TELEFONSIZ MIJOZ: ariza yaratilmaydi, raqam so‘raladi', async () => {
    const { user, part } = await setupPart({ phone: null });

    const result = await requestReplacement({
      installedPartId: part.id,
      telegramId: user.telegramId ?? 0n,
    });

    expect(result.status).toBe('PHONE_REQUIRED');
    expect(await prisma.lead.count()).toBe(0);
  });

  test('TAKRORIY BOSISH: eski xabardagi tugma qayta bosilsa dublikat ariza chiqmaydi', async () => {
    const { user, part } = await setupPart();

    const first = await requestReplacement({
      installedPartId: part.id,
      telegramId: user.telegramId ?? 0n,
    });
    const second = await requestReplacement({
      installedPartId: part.id,
      telegramId: user.telegramId ?? 0n,
    });

    expect(first.status).toBe('CREATED');
    expect(second.status).toBe('ALREADY_REQUESTED');
    expect(await prisma.lead.count()).toBe(1);
  });

  test('ARIZA YOPILGANDAN KEYIN yangi ariza yaratilishi mumkin', async () => {
    const { user, part } = await setupPart();
    await requestReplacement({ installedPartId: part.id, telegramId: user.telegramId ?? 0n });
    await prisma.lead.updateMany({ data: { status: 'DONE' } });

    const again = await requestReplacement({
      installedPartId: part.id,
      telegramId: user.telegramId ?? 0n,
    });

    expect(again.status).toBe('CREATED');
    expect(await prisma.lead.count()).toBe(2);
  });

  test('MENEJERGA XABAR ketadi, lekin uning nosozligi arizani yo‘qotmaydi', async () => {
    const { user, part } = await setupPart();

    const result = await requestReplacement(
      { installedPartId: part.id, telegramId: user.telegramId ?? 0n },
      {
        notify: async () => {
          throw new Error('Telegram yiqildi');
        },
      },
    );

    expect(result.status).toBe('CREATED');
    expect(await prisma.lead.count()).toBe(1);
  });
});
