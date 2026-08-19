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
 * §6: birlashtirish AYNI PAYTDA eng xavfli amal — u boshqa mijozning
 * yozuvini o'chiradi va uning o'rnatishlarini ko'chiradi. Telefon shu yerda
 * shaxsni aniqlash kaliti, ya'ni raqamni bilgan odam yozuvni egallab olardi.
 * Shuning uchun MAVJUD yozuvga tegadigan har qanday birikma `verified`
 * bayrog'ini talab qiladi: raqam Telegram tomonidan tasdiqlangan
 * («Raqamni yuborish» tugmasi) yoki uni menejer CRM da kiritgan.
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

  async function makeFilter(slug = 'f1') {
    return prisma.product.create({
      data: { kind: 'FILTER', slug, nameUz: 'F', nameRu: 'F', price: '100' },
    });
  }

  describe('mehmon oqimi — telefon yagona kalit', () => {
    test('yangi telefon uchun yangi mijoz yaratiladi', async () => {
      const { user } = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });

      expect(user.phone).toBe('+998901234567');
      expect(user.name).toBe('Aziz');
      expect(await prisma.user.count()).toBe(1);
    });

    test('o‘sha telefon ikkinchi marta kelsa yangi mijoz yaratilmaydi', async () => {
      const first = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
      const second = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });

      expect(second.user.id).toBe(first.user.id);
      expect(await prisma.user.count()).toBe(1);
    });

    test('mavjud mijozning bo‘sh ismi to‘ldiriladi', async () => {
      await resolveLeadClient({ phone: '+998901234567' });
      const updated = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });

      expect(updated.user.name).toBe('Aziz');
    });

    test('mavjud ism yangi ariza tufayli o‘chirilmaydi', async () => {
      await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
      const after = await resolveLeadClient({ phone: '+998901234567' });

      expect(after.user.name).toBe('Aziz');
    });

    test('normallashmagan telefon rad etiladi', async () => {
      await expect(resolveLeadClient({ phone: '12345' })).rejects.toThrow();
      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('Telegram sessiyasi — o‘z yozuviga tegadigan holatlar', () => {
    test('Telegram mijozi telefon qoldirsa, telefon o‘sha profilga yoziladi', async () => {
      const tg = await prisma.user.create({ data: { telegramId: 555000111n, name: 'Aziz' } });

      const { user, phoneTaken } = await resolveLeadClient({
        phone: '+998901234567',
        telegramId: 555000111n,
      });

      // Bu yerda hech kimning yozuvi egallanmayapti: raqam bo'sh edi.
      expect(phoneTaken).toBe(false);
      expect(user.id).toBe(tg.id);
      expect(user.phone).toBe('+998901234567');
      expect(await prisma.user.count()).toBe(1);
    });

    test('birlashtiriladigan dublikat bo‘lmasa hech narsa o‘chirilmaydi', async () => {
      await resolveLeadClient({ phone: '+998901111111', name: 'Boshqa odam' });
      await prisma.user.create({ data: { telegramId: 555000111n } });

      await resolveLeadClient({ phone: '+998902222222', telegramId: 555000111n });

      expect(await prisma.user.count()).toBe(2);
      const other = await prisma.user.findUnique({ where: { phone: '+998901111111' } });
      expect(other?.name).toBe('Boshqa odam');
    });
  });

  describe('TASDIQLANGAN birlashtirish (§4.5)', () => {
    test('telefonli mehmon keyin Telegramdan kelsa, bitta profil qoladi', async () => {
      // Avval saytdan ariza qoldirgan (telegram_id yo'q).
      const { user: guest } = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
      // Keyin Mini App ga kirgan — alohida yozuv paydo bo'lgan.
      const tg = await prisma.user.create({ data: { telegramId: 555000111n } });
      expect(await prisma.user.count()).toBe(2);

      const { user } = await resolveLeadClient({
        phone: '+998901234567',
        telegramId: 555000111n,
        verified: true,
      });

      expect(await prisma.user.count()).toBe(1);
      expect(user.id).toBe(tg.id);
      expect(user.telegramId).toBe(555000111n);
      expect(user.phone).toBe('+998901234567');
      // Mehmon yozuvidagi ism yo'qolmasligi kerak.
      expect(user.name).toBe('Aziz');
      expect(await prisma.user.findUnique({ where: { id: guest.id } })).toBeNull();
    });

    test('arizalar yo‘qolmaydi — ular omon qolgan profilga ko‘chadi', async () => {
      const { user: guest } = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });
      await prisma.lead.create({
        data: { userId: guest.id, phone: '+998901234567', source: 'WEB', status: 'NEW' },
      });
      const tg = await prisma.user.create({ data: { telegramId: 555000111n } });

      await resolveLeadClient({ phone: '+998901234567', telegramId: 555000111n, verified: true });

      const leads = await prisma.lead.findMany();
      expect(leads).toHaveLength(1);
      expect(leads[0]?.userId).toBe(tg.id);
    });

    test('o‘rnatishlar yo‘qolmaydi — eslatmalar shunga bog‘liq', async () => {
      const { user: guest } = await resolveLeadClient({ phone: '+998901234567' });
      const filter = await makeFilter();
      await prisma.installation.create({
        data: { userId: guest.id, filterProductId: filter.id, installedAt: new Date() },
      });
      const tg = await prisma.user.create({ data: { telegramId: 555000111n } });

      await resolveLeadClient({ phone: '+998901234567', telegramId: 555000111n, verified: true });

      const installations = await prisma.installation.findMany();
      expect(installations).toHaveLength(1);
      expect(installations[0]?.userId).toBe(tg.id);
    });

    test('Telegram yozuvi yo‘q bo‘lsa, telegram_id mavjud yozuvga ulanadi', async () => {
      const { user: guest } = await resolveLeadClient({ phone: '+998901234567', name: 'Aziz' });

      const { user } = await resolveLeadClient({
        phone: '+998901234567',
        telegramId: 555000111n,
        verified: true,
      });

      expect(user.id).toBe(guest.id);
      expect(user.telegramId).toBe(555000111n);
      expect(await prisma.user.count()).toBe(1);
    });
  });

  /**
   * §6 — hisobni egallab olishga urinish.
   *
   * Hujum oddiy: buzg'unchi Telegram orqali kiradi va ariza formasiga
   * mijozning raqamini yozadi. Tasdiqsiz birlashtirishda uning yozuvi
   * mijoznikini yutib yuborardi: o'rnatishlar (manzili bilan) va arizalar
   * buzg'unchiga ko'chib, «Mening filtrim» da ko'rinardi, mijozning yozuvi
   * esa butunlay o'chib ketardi — u eslatmalarsiz qolardi va buni hech kim
   * sezmasdi.
   *
   * Raqamni bilish qiyin emas: u vizitkada ham, e'londa ham bo'ladi.
   */
  describe('TASDIQLANMAGAN raqam — begona yozuv himoyalanadi', () => {
    async function makeVictim() {
      const victim = await prisma.user.create({
        data: { phone: '+998901234567', name: 'Mijoz' },
      });
      const filter = await makeFilter('victim-filter');
      const installation = await prisma.installation.create({
        data: {
          userId: victim.id,
          filterProductId: filter.id,
          installedAt: new Date(),
          address: 'Chilonzor 5',
        },
      });
      return { victim, installation };
    }

    test('mavjud Telegram yozuvi begona raqamni yutib yubormaydi', async () => {
      const { victim, installation } = await makeVictim();
      const attacker = await prisma.user.create({ data: { telegramId: 555000111n } });

      const { user, phoneTaken } = await resolveLeadClient({
        phone: '+998901234567',
        telegramId: 555000111n,
      });

      expect(phoneTaken).toBe(true);
      // Buzg'unchi o'z yozuvida qoladi va raqam unga yozilmaydi.
      expect(user.id).toBe(attacker.id);
      expect(user.phone).toBeNull();
      // Mijozning yozuvi va o'rnatishi joyida.
      expect(await prisma.user.count()).toBe(2);
      const kept = await prisma.user.findUnique({ where: { id: victim.id } });
      expect(kept?.phone).toBe('+998901234567');
      expect(
        (await prisma.installation.findUniqueOrThrow({ where: { id: installation.id } })).userId,
      ).toBe(victim.id);
    });

    test('Telegram yozuvi yo‘q bo‘lsa ham begona yozuvga ulanib bo‘lmaydi', async () => {
      // Bu variant yanada oson edi: buzg'unchining yozuvi umuman bo'lmasa,
      // telegram_id to'g'ridan-to'g'ri mijozning yozuviga yozilardi va u
      // mijozning butun profilini oladi.
      const { victim } = await makeVictim();

      const { user, phoneTaken } = await resolveLeadClient({
        phone: '+998901234567',
        telegramId: 555000111n,
      });

      expect(phoneTaken).toBe(true);
      expect(user.id).not.toBe(victim.id);
      expect(user.telegramId).toBe(555000111n);
      expect(user.phone).toBeNull();

      const kept = await prisma.user.findUniqueOrThrow({ where: { id: victim.id } });
      expect(kept.telegramId).toBeNull();
    });

    test('o‘z raqamini qayta yuborish hech narsani buzmaydi', async () => {
      // Mijozning o'zi: raqam allaqachon uning yozuvida.
      await prisma.user.create({ data: { telegramId: 555000111n, phone: '+998901234567' } });

      const { user, phoneTaken } = await resolveLeadClient({
        phone: '+998901234567',
        telegramId: 555000111n,
      });

      expect(phoneTaken).toBe(false);
      expect(user.telegramId).toBe(555000111n);
      expect(await prisma.user.count()).toBe(1);
    });
  });
});
