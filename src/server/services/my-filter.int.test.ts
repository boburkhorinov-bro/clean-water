import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { markPartReplaced, registerInstallation } from './installations';
import { getMyFilterView } from './my-filter';

/**
 * §2: «Mening filtrim» — o'rnatilgan apparat, kartrijlar, qolgan resurs
 * shkalasi, almashtirishga buyurtma tugmasi.
 */
describe('getMyFilterView', () => {
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

  async function setup(options: { installedAt?: Date; address?: string } = {}) {
    seq += 1;
    const user = await prisma.user.create({
      data: { phone: `+99890123456${seq}`, name: 'Aziz', telegramId: BigInt(555000 + seq) },
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
      installedAt: options.installedAt ?? tashkent('2026-02-15T09:00:00'),
      ...(options.address ? { address: options.address } : {}),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = installation.parts[0];
    if (!part) throw new Error('test sozlamasi buzilgan');

    return { user, filter, cartridge, installation, part };
  }

  test('o‘rnatishi yo‘q mijoz uchun bo‘sh ro‘yxat', async () => {
    const user = await prisma.user.create({ data: { phone: '+998901234567' } });

    expect(await getMyFilterView(user.id, 'uz')).toEqual([]);
  });

  test('apparat, kartrij va muddat ko‘rsatiladi', async () => {
    const { user } = await setup({ address: 'Toshkent, Chilonzor 12' });

    const view = await getMyFilterView(user.id, 'uz', tashkent('2026-05-16T09:00:00'));

    expect(view).toHaveLength(1);
    expect(view[0]?.filterName).toBe('Osmos 5');
    expect(view[0]?.address).toBe('Toshkent, Chilonzor 12');
    expect(view[0]?.parts[0]?.cartridgeName).toBe('Mexanik kartrij');
    expect(view[0]?.parts[0]?.dueAt).toEqual(tashkent('2026-08-15T09:00:00'));
  });

  test('SHKALA HAQIQIY SANALARDAN: yarim yo‘lda taxminan yarmi', async () => {
    const { user } = await setup();

    const view = await getMyFilterView(user.id, 'uz', tashkent('2026-05-16T09:00:00'));

    const progress = view[0]?.parts[0]?.progress;
    expect(progress?.usedRatio).toBeGreaterThan(0.45);
    expect(progress?.usedRatio).toBeLessThan(0.55);
    expect(progress?.state).toBe('OK');
  });

  test('muddat yaqinlashganda holat o‘zgaradi', async () => {
    const { user } = await setup();

    const view = await getMyFilterView(user.id, 'uz', tashkent('2026-08-01T09:00:00'));

    expect(view[0]?.parts[0]?.progress.state).toBe('SOON');
    expect(view[0]?.parts[0]?.progress.daysLeft).toBe(14);
  });

  test('ALMASHTIRILGAN kartrij ko‘rsatilmaydi, yangisi ko‘rsatiladi', async () => {
    const { user, part } = await setup();
    const replacement = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2026-08-15T09:00:00'),
    });

    const view = await getMyFilterView(user.id, 'uz', tashkent('2026-09-01T09:00:00'));

    const parts = view[0]?.parts ?? [];
    expect(parts).toHaveLength(1);
    expect(parts[0]?.id).toBe(replacement.next.id);
    expect(parts[0]?.dueAt).toEqual(tashkent('2027-02-15T09:00:00'));
  });

  test('nomlar mijoz tilida', async () => {
    const { user } = await setup();

    const view = await getMyFilterView(user.id, 'ru', tashkent('2026-05-16T09:00:00'));

    expect(view[0]?.filterName).toBe('Осмос 5');
    expect(view[0]?.parts[0]?.cartridgeName).toBe('Механический картридж');
  });

  test('BEGONA O‘RNATISH ko‘rinmaydi', async () => {
    const mine = await setup();
    await setup();

    const view = await getMyFilterView(mine.user.id, 'uz');

    expect(view).toHaveLength(1);
    expect(view[0]?.id).toBe(mine.installation.id);
  });

  test('BIR NECHTA O‘RNATISH: eng yangisi birinchi (§5)', async () => {
    const { user, filter } = await setup({ address: 'Uy' });
    await prisma.installation.create({
      data: {
        userId: user.id,
        filterProductId: filter.id,
        installedAt: tashkent('2026-06-01T09:00:00'),
        address: 'Dala hovli',
      },
    });

    const view = await getMyFilterView(user.id, 'uz');

    expect(view.map((i) => i.address)).toEqual(['Dala hovli', 'Uy']);
  });
});
