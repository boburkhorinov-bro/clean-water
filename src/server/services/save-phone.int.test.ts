import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { savePhoneForTelegramUser } from './save-phone';

/**
 * Telefonsiz Mini App mijozidan raqam olish (§4.5, §5).
 *
 * Telegram avtorizatsiyasi telefon bermaydi — faqat `telegram_id`. Shuning
 * uchun ilovaga birinchi kirgan mijozning `phone` maydoni bo'sh bo'ladi va u
 * «Almashtirishga buyurtma» tugmasini bosganda `PHONE_REQUIRED` ga urilardi:
 * ariza yaratilmasdi, menejer esa urinish bo'lganini bilmasdi.
 *
 * Bu servis — o'sha tuzoqning chiqish yo'li. Ikkala kirish nuqtasi (botdagi
 * «Raqamni ulashish» va Mini App dagi forma) shu yerga keladi.
 *
 * Alohida birlashtirish mantig'i YOZILMAYDI: `resolveLeadClient` buni
 * allaqachon qiladi va sinovdan o'tgan. Ikkinchi nusxa ikkita farqli
 * xatti-harakat degani bo'lardi.
 */
describe('savePhoneForTelegramUser', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('telefonsiz Telegram mijoziga raqam yoziladi', async () => {
    const created = await prisma.user.create({ data: { telegramId: 555n } });

    const result = await savePhoneForTelegramUser({
      telegramId: 555n,
      phone: '+998901234567',
    });

    expect(result.status).toBe('SAVED');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(user.phone).toBe('+998901234567');
  });

  test('raqam normallashtiriladi — Telegram uni ixtiyoriy shaklda beradi', async () => {
    await prisma.user.create({ data: { telegramId: 555n } });

    // Telegram `contact.phone_number` ni `+` siz ham, bo'shliqlar bilan ham
    // berishi mumkin; mijoz esa formaga xohlagan shaklda yozadi.
    const result = await savePhoneForTelegramUser({ telegramId: 555n, phone: '998 90 123-45-67' });

    expect(result.status).toBe('SAVED');
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 555n } })).phone).toBe(
      '+998901234567',
    );
  });

  test('noto‘g‘ri raqam rad etiladi va baza o‘zgarmaydi', async () => {
    await prisma.user.create({ data: { telegramId: 555n } });

    const result = await savePhoneForTelegramUser({ telegramId: 555n, phone: '12345' });

    expect(result.status).toBe('INVALID_PHONE');
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 555n } })).phone).toBeNull();
  });

  test('bo‘sh ism to‘ldiriladi, mavjudi o‘chirilmaydi', async () => {
    await prisma.user.create({ data: { telegramId: 555n, name: 'Aziz' } });
    await savePhoneForTelegramUser({ telegramId: 555n, phone: '+998901234567', name: 'Azizbek' });

    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 555n } })).name).toBe('Aziz');

    await prisma.user.create({ data: { telegramId: 777n } });
    await savePhoneForTelegramUser({ telegramId: 777n, phone: '+998901111111', name: 'Dilnoza' });

    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 777n } })).name).toBe(
      'Dilnoza',
    );
  });

  /**
   * Eng muhim holat: aynan shu tuzoq qanday yuzaga kelgan bo'lsa, shunday.
   * Menejer mijozni CRM da telefon bo'yicha yozgan (o'rnatish o'sha yozuvda),
   * mijoz esa keyin Mini App ni ochgan va ikkinchi, telefonsiz yozuv paydo
   * bo'lgan. Raqam kiritilgach ikkalasi bitta bo'lishi va o'rnatish Telegram
   * yozuviga ko'chishi shart — aks holda «Mening filtrim» bo'sh qolaveradi.
   */
  test('CRM dagi yozuv bilan birlashadi — o‘rnatish Telegram yozuviga ko‘chadi', async () => {
    const guest = await prisma.user.create({
      data: { phone: '+998901234567', name: 'Aziz' },
    });
    const filter = await prisma.product.create({
      data: {
        kind: 'FILTER',
        slug: 'osmos-1',
        nameUz: 'Osmos 1',
        nameRu: 'Осмос 1',
        price: 1_000_000,
      },
    });
    await prisma.installation.create({
      data: { userId: guest.id, filterProductId: filter.id, installedAt: new Date('2026-01-10') },
    });
    await prisma.user.create({ data: { telegramId: 555n } });

    const result = await savePhoneForTelegramUser({ telegramId: 555n, phone: '+998901234567' });

    expect(result.status).toBe('SAVED');
    expect(await prisma.user.count()).toBe(1);

    const survivor = await prisma.user.findUniqueOrThrow({ where: { telegramId: 555n } });
    expect(survivor.phone).toBe('+998901234567');
    expect(await prisma.installation.count({ where: { userId: survivor.id } })).toBe(1);
  });
});
