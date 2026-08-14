import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { InstallationError, markPartReplaced, registerInstallation } from './installations';

/**
 * CRM: kartrij almashtirilganini belgilash va keyingi muddatni hisoblash
 * (§7 dagi 6-band).
 *
 * Almashtirish eski qatorni «yopadi» va YANGI `InstalledPart` yaratadi.
 * Nega shunday: eslatmalar idempotentligi `(installed_part_id, kind)` unikal
 * indeksiga tayanadi (§4.6). Bir qatorni qayta ishlatsak, keyingi sikl uchun
 * eslatmalar hech qachon yuborilmasdi — indeks ularni dublikat deb rad etardi.
 *
 * Va ikkinchi qoida: keyingi muddat ALMASHTIRISH sanasidan hisoblanadi, eski
 * `due_at` dan emas. Mijoz ikki oy kechikib almashtirsa, yangi kartrij o'sha
 * kundan boshlab ishlaydi — jadval surilishi kerak.
 */
describe('markPartReplaced', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function tashkent(iso: string): Date {
    return new Date(`${iso}+05:00`);
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

  /** 6 oylik mexanik kartrij bilan o'rnatilgan apparat — barcha testlarning boshlanishi. */
  async function setup(resourceMonths = 6, installedAt = tashkent('2026-08-15T10:00:00')) {
    const user = await prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz' } });
    const filter = await prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: 'osmos-5',
        nameUz: 'Osmos 5',
        nameRu: 'Осмос 5',
        price: '2500000',
      },
    });
    const cartridge = await createCartridge('mexanika', resourceMonths);

    const installation = await registerInstallation({
      userId: user.id,
      filterProductId: filter.id,
      installedAt,
      parts: [{ cartridgeProductId: cartridge.id }],
    });

    const part = installation.parts[0];
    if (!part) throw new Error('test sozlamasi buzilgan');

    return { user, filter, cartridge, installation, part };
  }

  test('eski kartrijda `replaced_at` to‘ladi', async () => {
    const { part } = await setup();

    await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
    });

    const stored = await prisma.installedPart.findUniqueOrThrow({ where: { id: part.id } });
    expect(stored.replacedAt).toEqual(tashkent('2027-02-20T11:00:00'));
  });

  test('YANGI QATOR yaratiladi — o‘sha o‘rnatishda, almashtirish sanasidan boshlab', async () => {
    const { installation, part, cartridge } = await setup();

    const result = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
    });

    expect(result.next.id).not.toBe(part.id);
    expect(result.next.installationId).toBe(installation.id);
    expect(result.next.cartridgeProductId).toBe(cartridge.id);
    expect(result.next.installedAt).toEqual(tashkent('2027-02-20T11:00:00'));
    expect(result.next.replacedAt).toBeNull();
  });

  test('KEYINGI DUE_AT almashtirish sanasidan hisoblanadi, eski muddatdan emas', async () => {
    // 15-avgustda o'rnatilgan 6 oylik kartrijning muddati — 15-fevral.
    const { part } = await setup(6);
    expect(part.dueAt).toEqual(tashkent('2027-02-15T10:00:00'));

    // Mijoz besh kun kechikib almashtirdi.
    const result = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
    });

    // 20-fevral + 6 oy. Eski muddatga (15-fevral) qo'shilsa 15-avgust chiqardi.
    expect(result.next.dueAt).toEqual(tashkent('2027-08-20T11:00:00'));
  });

  test('KO‘P KECHIKISH: ikki oy kechikkan almashtirish jadvalni suradi', async () => {
    const { part } = await setup(6);

    const result = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-04-15T10:00:00'),
    });

    expect(result.next.dueAt).toEqual(tashkent('2027-10-15T10:00:00'));
  });

  test('OY OXIRI: 31-yanvarda almashtirilgan 1 oylik kartrij 28-fevralda tugaydi', async () => {
    const { part } = await setup(1, tashkent('2025-12-31T09:00:00'));

    const result = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2026-01-31T09:00:00'),
    });

    expect(result.next.dueAt).toEqual(tashkent('2026-02-28T09:00:00'));
  });

  test('BOSHQA MODELGA almashtirilsa, yangi modelning resursi ishlatiladi', async () => {
    const { part } = await setup(6);
    const uzoqroq = await createCartridge('membrana', 24);

    const result = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
      cartridgeProductId: uzoqroq.id,
    });

    expect(result.next.cartridgeProductId).toBe(uzoqroq.id);
    expect(result.next.dueAt).toEqual(tashkent('2029-02-20T11:00:00'));
  });

  test('IKKINCHI MARTA almashtirishga urinish rad etiladi', async () => {
    const { part } = await setup();
    await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
    });

    await expect(
      markPartReplaced({
        installedPartId: part.id,
        replacedAt: tashkent('2027-03-01T11:00:00'),
      }),
    ).rejects.toThrow(InstallationError);

    // Ikkita emas, bitta yangi qator bo'lishi kerak.
    expect(await prisma.installedPart.count()).toBe(2);
  });

  test('WORKER TANLOVI: almashtirilgan kartrij eslatma qidiruvidan chiqadi', async () => {
    const { part } = await setup();

    const result = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
    });

    const active = await prisma.installedPart.findMany({ where: { replacedAt: null } });
    expect(active.map((p) => p.id)).toEqual([result.next.id]);
  });

  test('ESLATMALAR QAYTA BOSHLANADI: yangi qatorda eski eslatmalar yo‘q', async () => {
    const { part } = await setup();
    // Eski kartrij bo'yicha uchala eslatma yuborilgan.
    for (const kind of ['DAYS_30', 'DAYS_7', 'DUE'] as const) {
      await prisma.notification.create({
        data: {
          installedPartId: part.id,
          kind,
          scheduledAt: tashkent('2027-01-15T09:00:00'),
          status: 'SENT',
        },
      });
    }

    const result = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
    });

    expect(await prisma.notification.count({ where: { installedPartId: result.next.id } })).toBe(0);
    // Eski eslatmalar tarix sifatida joyida qoladi.
    expect(await prisma.notification.count({ where: { installedPartId: part.id } })).toBe(3);
  });

  test('almashtirish o‘rnatish sanasidan oldin bo‘lishi mumkin emas', async () => {
    const { part } = await setup(6, tashkent('2026-08-15T10:00:00'));

    await expect(
      markPartReplaced({
        installedPartId: part.id,
        replacedAt: tashkent('2026-08-14T10:00:00'),
      }),
    ).rejects.toThrow(InstallationError);
  });

  test('ATOMARLIK: yangi kartrij resurssiz bo‘lsa, eskisi ham yopilmaydi', async () => {
    const { part } = await setup();
    const noSpec = await prisma.product.create({
      data: { kind: 'CARTRIDGE', slug: 'nomalum', nameUz: 'N', nameRu: 'N', price: '1' },
    });

    await expect(
      markPartReplaced({
        installedPartId: part.id,
        replacedAt: tashkent('2027-02-20T11:00:00'),
        cartridgeProductId: noSpec.id,
      }),
    ).rejects.toThrow(InstallationError);

    const stored = await prisma.installedPart.findUniqueOrThrow({ where: { id: part.id } });
    expect(stored.replacedAt).toBeNull();
    expect(await prisma.installedPart.count()).toBe(1);
  });

  test('mavjud bo‘lmagan kartrij qatori rad etiladi', async () => {
    await expect(
      markPartReplaced({
        installedPartId: '00000000-0000-0000-0000-000000000000',
        replacedAt: tashkent('2027-02-20T11:00:00'),
      }),
    ).rejects.toThrow(InstallationError);
  });

  test('yaroqsiz almashtirish sanasi rad etiladi', async () => {
    const { part } = await setup();

    await expect(
      markPartReplaced({
        installedPartId: part.id,
        replacedAt: new Date('shunday sana yo‘q'),
      }),
    ).rejects.toThrow(InstallationError);
  });

  test('ketma-ket almashtirishlar zanjiri to‘g‘ri quriladi', async () => {
    const { part } = await setup(6);

    const first = await markPartReplaced({
      installedPartId: part.id,
      replacedAt: tashkent('2027-02-20T11:00:00'),
    });
    const second = await markPartReplaced({
      installedPartId: first.next.id,
      replacedAt: tashkent('2027-08-25T11:00:00'),
    });

    expect(second.next.dueAt).toEqual(tashkent('2028-02-25T11:00:00'));
    expect(await prisma.installedPart.count()).toBe(3);
    expect(await prisma.installedPart.count({ where: { replacedAt: null } })).toBe(1);
  });
});
