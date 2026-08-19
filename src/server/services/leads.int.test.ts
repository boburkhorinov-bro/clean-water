import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { createLead } from './leads';

/**
 * §4.5 — ariza oqimi. Eng muhim talab shu bo'limning oxirida:
 *
 *   «Telegram API ning ishlamay qolishi arizani yo'qotmasligi kerak.
 *    Avval baza, keyin xabar.»
 *
 * Ya'ni xabarnoma nosozligi mijozga xato sifatida ko'rinmasligi va ariza
 * bazada qolishi shart. Buni tekshirmaslik — biznes uchun eng qimmat
 * xatoni ochiq qoldirish.
 */
describe('createLead', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedFilter() {
    return prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: 'osmos-5',
        nameUz: 'Osmos 5',
        nameRu: 'Осмос 5',
        price: '2500000',
      },
    });
  }

  test('ariza NEW statusi bilan yoziladi', async () => {
    const product = await seedFilter();

    const lead = await createLead({
      phone: '+998901234567',
      name: 'Aziz',
      productId: product.id,
      source: 'WEB',
    });

    expect(lead.status).toBe('NEW');
    expect(lead.phone).toBe('+998901234567');
    expect(await prisma.lead.count()).toBe(1);
  });

  test('mijoz yaratiladi va arizaga bog‘lanadi', async () => {
    await createLead({ phone: '901234567', source: 'WEB' });

    const user = await prisma.user.findUnique({ where: { phone: '+998901234567' } });
    const lead = await prisma.lead.findFirst();

    expect(user).not.toBeNull();
    expect(lead?.userId).toBe(user?.id);
  });

  test('telefon normallashtirilib saqlanadi', async () => {
    const lead = await createLead({ phone: '(90) 123-45-67', source: 'MINIAPP' });

    expect(lead.phone).toBe('+998901234567');
  });

  test('TELEGRAM YIQILSA HAM ARIZA YO‘QOLMAYDI', async () => {
    const notify = vi.fn().mockRejectedValue(new Error('Telegram API 503'));

    const lead = await createLead({ phone: '+998901234567', source: 'WEB' }, { notify });

    // Mijozga xato ko'rinmaydi va yozuv bazada.
    expect(lead.status).toBe('NEW');
    expect(await prisma.lead.count()).toBe(1);
    expect(notify).toHaveBeenCalledOnce();
  });

  test('XABARNOMA OSILIB QOLSA HAM ARIZA QAYTARILADI', async () => {
    // Hech qachon hal bo'lmaydigan promise — tashqi servis «osilgan» holati.
    const notify = vi.fn().mockImplementation(() => new Promise(() => {}));

    const lead = await createLead(
      { phone: '+998901234567', source: 'WEB' },
      { notify, notifyTimeoutMs: 50 },
    );

    expect(lead.status).toBe('NEW');
    expect(await prisma.lead.count()).toBe(1);
  });

  test('xabarnoma arizani oladi', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const product = await seedFilter();

    await createLead(
      { phone: '+998901234567', name: 'Aziz', productId: product.id, source: 'MINIAPP' },
      { notify },
    );

    expect(notify).toHaveBeenCalledOnce();
    const arg = notify.mock.calls[0]?.[0];
    expect(arg).toMatchObject({ phone: '+998901234567', name: 'Aziz', status: 'NEW' });
  });

  test('yaroqsiz telefon rad etiladi va bazaga hech narsa yozilmaydi', async () => {
    await expect(createLead({ phone: '12345', source: 'WEB' })).rejects.toThrow();

    expect(await prisma.lead.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  test('mavjud bo‘lmagan mahsulot rad etiladi', async () => {
    await expect(
      createLead({
        phone: '+998901234567',
        productId: '00000000-0000-4000-8000-000000000000',
        source: 'WEB',
      }),
    ).rejects.toThrow();

    expect(await prisma.lead.count()).toBe(0);
  });

  test('o‘chirilgan mahsulotga ariza qabul qilinmaydi', async () => {
    const product = await seedFilter();
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

    await expect(
      createLead({ phone: '+998901234567', productId: product.id, source: 'WEB' }),
    ).rejects.toThrow();
  });

  test('mahsulotsiz ariza joiz — «menejer bilan bog‘laning» stsenariysi', async () => {
    const lead = await createLead({ phone: '+998901234567', source: 'WEB' });

    expect(lead.productId).toBeNull();
  });

  test('Telegram mijozi ariza qoldirsa dublikat yaratilmaydi (§4.5)', async () => {
    await prisma.user.create({ data: { telegramId: 555000111n, name: 'Aziz' } });

    await createLead({ phone: '+998901234567', source: 'MINIAPP', telegramId: 555000111n });

    expect(await prisma.user.count()).toBe(1);
    const user = await prisma.user.findUnique({ where: { telegramId: 555000111n } });
    expect(user?.phone).toBe('+998901234567');
  });

  /**
   * §6 — hisobni egallab olishga urinish, eng ochiq yo'l orqali.
   *
   * Ariza formasi ommaviy: raqamni istalgan odam yozadi, `telegramId` esa
   * sessiyadan keladi. Tasdiqsiz birlashtirishda buzg'unchi shu ikkisini
   * qo'shib, boshqa mijozning yozuvini o'ziga ko'chirib olardi —
   * o'rnatishlari (manzili bilan), arizalari va eslatmalari bilan birga,
   * mijozning yozuvi esa butunlay o'chib ketardi.
   *
   * Ariza baribir yaratiladi: haqiqiy mijoz ham shu yo'ldan keladi va
   * uni rad etish sotuvni yo'qotardi. Raqam `Lead.phone` da qoladi —
   * menejer ko'radi va kerak bo'lsa CRM da qo'lda birlashtiradi.
   */
  test('BEGONA raqamli ariza mijoz yozuvini egallamaydi', async () => {
    const victim = await prisma.user.create({
      data: { phone: '+998901234567', name: 'Mijoz' },
    });
    const filter = await seedFilter();
    await prisma.installation.create({
      data: { userId: victim.id, filterProductId: filter.id, installedAt: new Date() },
    });
    const attacker = await prisma.user.create({ data: { telegramId: 555000111n } });

    const lead = await createLead({
      phone: '+998901234567',
      source: 'MINIAPP',
      telegramId: 555000111n,
    });

    // Ariza bor va raqam unda saqlangan.
    expect(lead.phone).toBe('+998901234567');
    expect(lead.userId).toBe(attacker.id);

    // Mijozning yozuvi va o'rnatishi tegilmagan.
    expect(await prisma.user.count()).toBe(2);
    const kept = await prisma.user.findUniqueOrThrow({ where: { id: victim.id } });
    expect(kept.phone).toBe('+998901234567');
    expect(kept.telegramId).toBeNull();
    expect(await prisma.installation.count({ where: { userId: victim.id } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: attacker.id } })).phone).toBeNull();
  });
});
