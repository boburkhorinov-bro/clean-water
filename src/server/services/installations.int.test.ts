import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { InstallationError, registerInstallation } from './installations';

/**
 * CRM: o'rnatishlarni qayd qilish (§7 dagi 6-band, §5).
 *
 * Eng nozik joy — `due_at`. TZ §5: «`due_at` buyurtma sanasidan emas, aniq
 * kartrijning `installed_at` + `resource_months` idan hisoblanadi.» Bitta
 * apparatda 6, 12 va 24 oylik kartrijlar birga turadi: agar muddat butun
 * o'rnatishga bitta qilib qo'yilsa, membrana ikki yil erta, mexanika esa bir
 * yarim yil kech almashtiriladi.
 */
describe('registerInstallation', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Toshkent vaqtidagi sana — hisob mahalliy kalendar bo'yicha yuritiladi. */
  function tashkent(iso: string): Date {
    return new Date(`${iso}+05:00`);
  }

  async function createClient() {
    return prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz' } });
  }

  async function createFilter(slug = 'osmos-5') {
    return prisma.product.create({
      data: { kind: 'FILTER', slug, nameUz: 'Osmos 5', nameRu: 'Осмос 5', price: '2500000' },
    });
  }

  async function createCartridge(slug: string, resourceMonths: number) {
    return prisma.product.create({
      data: {
        kind: 'CARTRIDGE',
        slug,
        nameUz: slug,
        nameRu: slug,
        price: '150000',
        cartridgeSpec: { create: { resourceMonths } },
      },
    });
  }

  test('o‘rnatish yoziladi: mijoz, apparat, sana, manzil', async () => {
    const user = await createClient();
    const filter = await createFilter();

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-08-15T10:00:00'),
      address: 'Toshkent, Chilonzor 12',
      note: 'Oshxonada, rakovina tagida',
      parts: [],
    });

    const stored = await prisma.installation.findUnique({ where: { id: installation.id } });
    expect(stored?.userId).toBe(user.id);
    expect(stored?.filterProductId).toBe(filter.id);
    expect(stored?.installedAt).toEqual(tashkent('2026-08-15T10:00:00'));
    expect(stored?.address).toBe('Toshkent, Chilonzor 12');
    expect(stored?.note).toBe('Oshxonada, rakovina tagida');
  });

  test('DUE_AT: har bir kartrij o‘z resursidan hisoblanadi, umumiy sanadan emas', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const mexanika = await createCartridge('mexanika', 6);
    const postfiltr = await createCartridge('postfiltr', 12);
    const membrana = await createCartridge('membrana', 24);

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-08-15T10:00:00'),
      parts: [
        { cartridgeProductId: mexanika.id },
        { cartridgeProductId: postfiltr.id },
        { cartridgeProductId: membrana.id },
      ],
    });

    const parts = await prisma.installedPart.findMany({
      where: { installationId: installation.id },
      orderBy: { dueAt: 'asc' },
    });

    expect(parts.map((p) => p.dueAt)).toEqual([
      tashkent('2027-02-15T10:00:00'), // 6 oy
      tashkent('2027-08-15T10:00:00'), // 12 oy
      tashkent('2028-08-15T10:00:00'), // 24 oy
    ]);
  });

  test('OY OXIRI: 31-yanvarda o‘rnatilgan 1 oylik kartrij 28-fevralda tugaydi', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const cartridge = await createCartridge('tez-tugaydigan', 1);

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-01-31T09:00:00'),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = await prisma.installedPart.findFirstOrThrow({
      where: { installationId: installation.id },
    });
    expect(part.dueAt).toEqual(tashkent('2026-02-28T09:00:00'));
  });

  test('KABISA YILI: 31-yanvar 2024 + 1 oy = 29-fevral', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const cartridge = await createCartridge('tez-tugaydigan', 1);

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2024-01-31T09:00:00'),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = await prisma.installedPart.findFirstOrThrow({
      where: { installationId: installation.id },
    });
    expect(part.dueAt).toEqual(tashkent('2024-02-29T09:00:00'));
  });

  test('kartrij keyinroq qo‘yilgan bo‘lsa, muddat O‘SHA sanadan hisoblanadi', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const cartridge = await createCartridge('membrana', 24);

    // Apparat avgustda o'rnatilgan, membrana esa oktabrda qo'yilgan.
    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-08-15T10:00:00'),
      parts: [{ cartridgeProductId: cartridge.id, installedAt: tashkent('2026-10-01T10:00:00') }],
    });

    const part = await prisma.installedPart.findFirstOrThrow({
      where: { installationId: installation.id },
    });
    expect(part.installedAt).toEqual(tashkent('2026-10-01T10:00:00'));
    expect(part.dueAt).toEqual(tashkent('2028-10-01T10:00:00'));
  });

  test('kartrij sanasi ko‘rsatilmasa, apparat o‘rnatilgan sana olinadi', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const cartridge = await createCartridge('mexanika', 6);

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-08-15T10:00:00'),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = await prisma.installedPart.findFirstOrThrow({
      where: { installationId: installation.id },
    });
    expect(part.installedAt).toEqual(tashkent('2026-08-15T10:00:00'));
  });

  test('yangi kartrij hali almashtirilmagan — `replaced_at` bo‘sh', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const cartridge = await createCartridge('mexanika', 6);

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-08-15T10:00:00'),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = await prisma.installedPart.findFirstOrThrow({
      where: { installationId: installation.id },
    });
    expect(part.replacedAt).toBeNull();
  });

  test('natijada kartrijlar mahsulot ma‘lumoti bilan qaytadi', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const cartridge = await createCartridge('membrana', 24);

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt: tashkent('2026-08-15T10:00:00'),
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    expect(installation.parts).toHaveLength(1);
    expect(installation.parts[0]?.cartridgeProduct.slug).toBe('membrana');
    expect(installation.filterProduct.slug).toBe('osmos-5');
  });

  test('RESURSSIZ KARTRIJ RAD ETILADI — muddatini hisoblab bo‘lmaydi', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const noSpec = await prisma.product.create({
      data: { kind: 'CARTRIDGE', slug: 'nomalum', nameUz: 'N', nameRu: 'N', price: '1' },
    });

    await expect(
      registerInstallation({
        userId: user.id,
        filterProductId: filter.id,
        installedAt: tashkent('2026-08-15T10:00:00'),
        parts: [{ cartridgeProductId: noSpec.id }],
      }),
    ).rejects.toThrow(InstallationError);
  });

  test('ATOMARLIK: bitta kartrij yaroqsiz bo‘lsa, o‘rnatish ham yozilmaydi', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const good = await createCartridge('mexanika', 6);
    const noSpec = await prisma.product.create({
      data: { kind: 'CARTRIDGE', slug: 'nomalum', nameUz: 'N', nameRu: 'N', price: '1' },
    });

    await expect(
      registerInstallation({
        userId: user.id,
        filterProductId: filter.id,
        installedAt: tashkent('2026-08-15T10:00:00'),
        parts: [{ cartridgeProductId: good.id }, { cartridgeProductId: noSpec.id }],
      }),
    ).rejects.toThrow(InstallationError);

    expect(await prisma.installation.count()).toBe(0);
    expect(await prisma.installedPart.count()).toBe(0);
  });

  test('kartrij o‘rniga filtr ko‘rsatilsa rad etiladi', async () => {
    const user = await createClient();
    const filter = await createFilter();
    const anotherFilter = await createFilter('osmos-6');

    await expect(
      registerInstallation({
        userId: user.id,
        filterProductId: filter.id,
        installedAt: tashkent('2026-08-15T10:00:00'),
        parts: [{ cartridgeProductId: anotherFilter.id }],
      }),
    ).rejects.toThrow(InstallationError);
  });

  test('apparat sifatida kartrij ko‘rsatilsa rad etiladi', async () => {
    const user = await createClient();
    const cartridge = await createCartridge('mexanika', 6);

    await expect(
      registerInstallation({
        userId: user.id,
        filterProductId: cartridge.id,
        installedAt: tashkent('2026-08-15T10:00:00'),
        parts: [],
      }),
    ).rejects.toThrow(InstallationError);
  });

  test('mavjud bo‘lmagan mijoz uchun o‘rnatish yozilmaydi', async () => {
    const filter = await createFilter();

    await expect(
      registerInstallation({
        userId: '00000000-0000-0000-0000-000000000000',
        filterProductId: filter.id,
        installedAt: tashkent('2026-08-15T10:00:00'),
        parts: [],
      }),
    ).rejects.toThrow(InstallationError);

    expect(await prisma.installation.count()).toBe(0);
  });

  test('BIR MIJOZDA BIR NECHTA O‘RNATISH: ikkinchisi birinchisini o‘chirmaydi (§5)', async () => {
    const user = await createClient();
    const home = await createFilter('uy-filtri');
    const dacha = await createFilter('dala-filtri');

    await registerInstallation({
      userId: user.id,
      filterProductId: home.id,
      installedAt: tashkent('2026-01-10T10:00:00'),
      address: 'Uy',
      parts: [],
    });
    await registerInstallation({
      userId: user.id,
      filterProductId: dacha.id,
      installedAt: tashkent('2026-03-20T10:00:00'),
      address: 'Dala hovli',
      parts: [],
    });

    const installations = await prisma.installation.findMany({ where: { userId: user.id } });
    expect(installations).toHaveLength(2);
  });

  test('yaroqsiz o‘rnatish sanasi rad etiladi', async () => {
    const user = await createClient();
    const filter = await createFilter();

    await expect(
      registerInstallation({
        userId: user.id,
        filterProductId: filter.id,
        installedAt: new Date('shunday sana yo‘q'),
        parts: [],
      }),
    ).rejects.toThrow(InstallationError);
  });
});
