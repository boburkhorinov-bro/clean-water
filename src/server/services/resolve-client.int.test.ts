import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { resolveLeadClient } from './resolve-client';

/**
 * §4.5: «Telefonni normallashtirish → mavjud mijozni qidirish →
 * **dublikatlarni birlashtirish**.»
 * §5: «Mijoz ikki marta kelishi mumkin: Telegramdan va saytdan telefon
 * bo'yicha. Raqam bo'yicha dublikatlarni birlashtirish kerak.»
 *
 * Nega bu muhim: dublikat qolsa, mijozning o'rnatishlari bir profilda,
 * Telegram ulanishi esa boshqasida qoladi — natijada kartrij eslatmalari
 * unga umuman yetib bormaydi.
 *
 * Bu testlar HAQIQIY PostgreSQL ga qarshi ishlaydi: mantiq butunlay baza
 * holati haqida, mock hech narsani isbotlamaydi.
 */
describe('resolveLeadClient', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('yangi telefon uchun yangi mijoz yaratiladi', async () => {
    const user = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });

    expect(user.phone).toBe('+998901234567');
    expect(user.name).toBe('Aziz');
    expect(await prisma.user.count()).toBe(1);
  });

  test('o‘sha telefon ikkinchi marta kelsa yangi mijoz yaratilmaydi', async () => {
    const first = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
    const second = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });

    expect(second.id).toBe(first.id);
    expect(await prisma.user.count()).toBe(1);
  });

  test('mavjud mijozning bo‘sh ismi to‘ldiriladi', async () => {
    await resolveLeadClient({ phone: '+998901234567' });
    const updated = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });

    expect(updated.name).toBe('Aziz');
  });

  test('mavjud ism yangi ariza tufayli o‘chirilmaydi', async () => {
    await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
    const after = await resolveLeadClient({ phone: '+998901234567' });

    expect(after.name).toBe('Aziz');
  });

  test('Telegram mijozi telefon qoldirsa, telefon o‘sha profilga yoziladi', async () => {
    const tg = await prisma.user.create({ data: { telegramId: 555000111n, name: 'Aziz' } });

    const resolved = await resolveLeadClient({ phone: '+998901234567', telegramId: 555000111n });

    expect(resolved.id).toBe(tg.id);
    expect(resolved.phone).toBe('+998901234567');
    expect(await prisma.user.count()).toBe(1);
  });

  test('DUBLIKAT BIRLASHTIRISH: telefonli mehmon keyin Telegramdan kelsa, bitta profil qoladi', async () => {
    // Avval saytdan ariza qoldirgan (telegram_id yo'q).
    const guest = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
    // Keyin Mini App ga kirgan — alohida yozuv paydo bo'lgan.
    const tg = await prisma.user.create({ data: { telegramId: 555000111n } });
    expect(await prisma.user.count()).toBe(2);

    const resolved = await resolveLeadClient({ phone: '+998901234567', telegramId: 555000111n });

    expect(await prisma.user.count()).toBe(1);
    expect(resolved.id).toBe(tg.id);
    expect(resolved.telegramId).toBe(555000111n);
    expect(resolved.phone).toBe('+998901234567');
    // Mehmon yozuvidagi ism yo'qolmasligi kerak.
    expect(resolved.name).toBe('Aziz');
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).toBeNull();
  });

  test('BIRLASHTIRISHDA arizalar yo‘qolmaydi — ular omon qolgan profilga ko‘chadi', async () => {
    const guest = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
    await prisma.lead.create({
      data: { userId: guest.id, phone: '+998901234567', source: 'WEB', status: 'NEW' },
    });
    const tg = await prisma.user.create({ data: { telegramId: 555000111n } });

    await resolveLeadClient({ phone: '+998901234567', telegramId: 555000111n });

    const leads = await prisma.lead.findMany();
    expect(leads).toHaveLength(1);
    expect(leads[0]?.userId).toBe(tg.id);
  });

  test('BIRLASHTIRISHDA o‘rnatishlar yo‘qolmaydi — eslatmalar shunga bog‘liq', async () => {
    const guest = await resolveLeadClient({ phone: '+998901234567' });
    const filter = await prisma.product.create({
      data: { kind: 'FILTER', slug: 'f1', nameUz: 'F', nameRu: 'F', price: '100' },
    });
    await prisma.installation.create({
      data: { userId: guest.id, filterProductId: filter.id, installedAt: new Date() },
    });
    const tg = await prisma.user.create({ data: { telegramId: 555000111n } });

    await resolveLeadClient({ phone: '+998901234567', telegramId: 555000111n });

    const installations = await prisma.installation.findMany();
    expect(installations).toHaveLength(1);
    expect(installations[0]?.userId).toBe(tg.id);
  });

  test('birlashtiriladigan dublikat bo‘lmasa hech narsa o‘chirilmaydi', async () => {
    await resolveLeadClient({ phone: '+998901111111', name: 'Boshqa odam' });
    const tg = await prisma.user.create({ data: { telegramId: 555000111n } });

    await resolveLeadClient({ phone: '+998902222222', telegramId: 555000111n });

    expect(await prisma.user.count()).toBe(2);
    const other = await prisma.user.findUnique({ where: { phone: '+998901111111' } });
    expect(other?.name).toBe('Boshqa odam');
    expect(tg.id).toBeDefined();
  });

  test('normallashmagan telefon rad etiladi', async () => {
    await expect(resolveLeadClient({ phone: '12345' })).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
  });
});
