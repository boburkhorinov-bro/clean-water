import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { getCartridgesForFilter, getFilterBySlug, listCartridges, listFilters } from './catalog';

/**
 * §4.2: «Biznes-mantiq React komponentlarida ham, route handler larda ham
 * yashamaydi... u uchta joydan (veb, Mini App, worker) chaqiriladi va bir xil
 * ishlashi kerak.»
 *
 * §2: kartrijlar katalogi «moslik va resurs ko'rsatilgan» bo'lishi kerak.
 */
describe('katalog servisi', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedCatalog() {
    const filter = await prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: 'osmos-5',
        nameUz: 'Osmos 5',
        nameRu: 'Осмос 5',
        price: '2500000',
      },
    });
    const otherFilter = await prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: 'osmos-3',
        nameUz: 'Osmos 3',
        nameRu: 'Осмос 3',
        price: '1500000',
      },
    });
    const cartridge = await prisma.product.create({
      data: {
        kind: 'CARTRIDGE',
        slug: 'membrana',
        nameUz: 'Membrana',
        nameRu: 'Мембрана',
        price: '450000',
        cartridgeSpec: { create: { resourceMonths: 24 } },
      },
    });
    await prisma.compatibility.create({
      data: { cartridgeId: cartridge.id, filterId: filter.id },
    });
    return { filter, otherFilter, cartridge };
  }

  test('faqat filtrlar qaytariladi, kartrijlar aralashmaydi', async () => {
    await seedCatalog();

    const filters = await listFilters();

    expect(filters).toHaveLength(2);
    expect(filters.every((f) => f.kind === 'FILTER')).toBe(true);
  });

  test('o‘chirilgan mahsulot katalogda ko‘rinmaydi', async () => {
    await seedCatalog();
    await prisma.product.update({ where: { slug: 'osmos-3' }, data: { isActive: false } });

    const filters = await listFilters();

    expect(filters.map((f) => f.slug)).toEqual(['osmos-5']);
  });

  test('kartrij resursi bilan birga qaytariladi (§2)', async () => {
    await seedCatalog();

    const cartridges = await listCartridges();

    expect(cartridges).toHaveLength(1);
    expect(cartridges[0]?.resourceMonths).toBe(24);
  });

  test('mahsulot slug bo‘yicha topiladi', async () => {
    await seedCatalog();

    const found = await getFilterBySlug('osmos-5');

    expect(found?.nameUz).toBe('Osmos 5');
  });

  test('mavjud bo‘lmagan slug uchun null — 500 emas', async () => {
    await seedCatalog();

    expect(await getFilterBySlug('yo-q-bunday')).toBeNull();
  });

  test('o‘chirilgan mahsulot slug bo‘yicha ham ochilmaydi', async () => {
    await seedCatalog();
    await prisma.product.update({ where: { slug: 'osmos-5' }, data: { isActive: false } });

    expect(await getFilterBySlug('osmos-5')).toBeNull();
  });

  test('filtrga mos kartrijlar qaytariladi', async () => {
    const { filter } = await seedCatalog();

    const cartridges = await getCartridgesForFilter(filter.id);

    expect(cartridges).toHaveLength(1);
    expect(cartridges[0]?.slug).toBe('membrana');
    expect(cartridges[0]?.resourceMonths).toBe(24);
  });

  test('mos kartriji yo‘q filtr uchun bo‘sh ro‘yxat', async () => {
    const { otherFilter } = await seedCatalog();

    expect(await getCartridgesForFilter(otherFilter.id)).toEqual([]);
  });

  test('BOSQICHLAR tartibi alifbo emas, `stage` bo‘yicha (§3)', async () => {
    // Haqiqiy tozalash yo'li: mexanik → ko'mir → membrana. Alifbo bo'yicha
    // esa bu ketma-ketlik buziladi — aynan shuning uchun `stage` kerak.
    const filter = await prisma.product.create({
      data: { kind: 'FILTER', slug: 'f', nameUz: 'F', nameRu: 'F', price: '1' },
    });
    const make = async (slug: string, name: string) =>
      prisma.product.create({
        data: { kind: 'CARTRIDGE', slug, nameUz: name, nameRu: name, price: '1' },
      });

    const membrana = await make('c-membrana', 'AAA membrana');
    const mexanik = await make('c-mexanik', 'ZZZ mexanik');
    const komir = await make('c-komir', 'MMM ko‘mir');

    await prisma.compatibility.createMany({
      data: [
        { cartridgeId: mexanik.id, filterId: filter.id, stage: 1 },
        { cartridgeId: komir.id, filterId: filter.id, stage: 2 },
        { cartridgeId: membrana.id, filterId: filter.id, stage: 3 },
      ],
    });

    const stages = await getCartridgesForFilter(filter.id);

    expect(stages.map((s) => s.slug)).toEqual(['c-mexanik', 'c-komir', 'c-membrana']);
    expect(stages.map((s) => s.stage)).toEqual([1, 2, 3]);
  });

  test('tartibsiz mosliklar oxirida keladi, raqamsiz holda', async () => {
    const filter = await prisma.product.create({
      data: { kind: 'FILTER', slug: 'f2', nameUz: 'F2', nameRu: 'F2', price: '1' },
    });
    const withStage = await prisma.product.create({
      data: { kind: 'CARTRIDGE', slug: 'bilan', nameUz: 'Bilan', nameRu: 'Bilan', price: '1' },
    });
    const without = await prisma.product.create({
      data: { kind: 'CARTRIDGE', slug: 'siz', nameUz: 'Aaa', nameRu: 'Aaa', price: '1' },
    });
    await prisma.compatibility.createMany({
      data: [
        { cartridgeId: without.id, filterId: filter.id },
        { cartridgeId: withStage.id, filterId: filter.id, stage: 1 },
      ],
    });

    const stages = await getCartridgesForFilter(filter.id);

    expect(stages.map((s) => s.slug)).toEqual(['bilan', 'siz']);
    expect(stages[1]?.stage).toBeNull();
  });

  test('narx satr sifatida va aniq qaytariladi — pul float ga aylanmaydi', async () => {
    await seedCatalog();
    await prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: 'tiyinli',
        nameUz: 'Tiyinli',
        nameRu: 'С копейками',
        price: '1234567.89',
      },
    });

    const filters = await listFilters();

    // Muhim xossa formatlash emas, ANIQLIK: qiymat satr bo'lib qoladi
    // (Prisma Decimal obyekti Server → Client Component ga uzatilmaydi)
    // va o'nlik qismi yo'qolmaydi.
    const kopeck = filters.find((f) => f.slug === 'tiyinli');
    expect(typeof kopeck?.price).toBe('string');
    expect(kopeck?.price).toBe('1234567.89');

    const round = filters.find((f) => f.slug === 'osmos-5');
    expect(Number(round?.price)).toBe(2500000);
  });
});
