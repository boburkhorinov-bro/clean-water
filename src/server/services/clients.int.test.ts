import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import { getClientProfile, listClients, registerClient } from './clients';

/**
 * CRM, mijozlar bazasi (§7 dagi 6-band, §5).
 *
 * Menejer mijozni telefon bo'yicha qidiradi — mijoz raqamini og'zaki aytadi
 * va u qanday yozilgani muhim emas. Profilda esa uning BARCHA o'rnatishlari
 * ko'rinishi kerak: §5 ga ko'ra bitta mijozda bir nechta apparat bo'lishi
 * mumkin (uy, dala hovli) va har birining o'z kartrijlari bor.
 *
 * Testlar haqiqiy bazaga qarshi: mantiq butunlay so'rovlar va bog'lanishlar
 * haqida, mock hech narsani isbotlamaydi.
 */
describe('CRM mijozlar bazasi', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createFilter(slug: string) {
    return prisma.product.create({
      data: {
        kind: 'FILTER',
        slug,
        nameUz: `Filtr ${slug}`,
        nameRu: `Фильтр ${slug}`,
        price: '100',
      },
    });
  }

  describe('listClients', () => {
    test('bo‘sh bazada bo‘sh ro‘yxat qaytaradi', async () => {
      const result = await listClients({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('yangi qo‘shilgan mijoz ro‘yxat boshida turadi', async () => {
      await prisma.user.create({ data: { phone: '+998901111111', name: 'Birinchi' } });
      await prisma.user.create({ data: { phone: '+998902222222', name: 'Ikkinchi' } });

      const result = await listClients({});

      expect(result.items.map((c) => c.name)).toEqual(['Ikkinchi', 'Birinchi']);
      expect(result.total).toBe(2);
    });

    test('TELEFON BO‘YICHA QIDIRUV: raqam qanday yozilganidan qat‘i nazar topiladi', async () => {
      await prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz' } });
      await prisma.user.create({ data: { phone: '+998907654321', name: 'Bekzod' } });

      for (const query of ['+998901234567', '998901234567', '901234567', '90 123 45 67']) {
        const result = await listClients({ query });
        expect(
          result.items.map((c) => c.name),
          `qidiruv: ${query}`,
        ).toEqual(['Aziz']);
      }
    });

    test('telefon bo‘lagi bo‘yicha ham qidiriladi — menejer oxirgi raqamlarni eslaydi', async () => {
      await prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz' } });
      await prisma.user.create({ data: { phone: '+998907654321', name: 'Bekzod' } });

      const result = await listClients({ query: '4567' });

      expect(result.items.map((c) => c.name)).toEqual(['Aziz']);
    });

    test('ism bo‘yicha qidiruv registrga sezgir emas', async () => {
      await prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz Karimov' } });
      await prisma.user.create({ data: { phone: '+998907654321', name: 'Bekzod' } });

      const result = await listClients({ query: 'kARIMOV' });

      expect(result.items.map((c) => c.name)).toEqual(['Aziz Karimov']);
    });

    test('mos kelmaydigan qidiruv bo‘sh natija beradi', async () => {
      await prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz' } });

      const result = await listClients({ query: 'bunday odam yo‘q' });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('sahifalash: `total` filtrlangan hammasini, `items` faqat sahifani beradi', async () => {
      for (let i = 0; i < 5; i += 1) {
        await prisma.user.create({ data: { phone: `+99890111111${i}`, name: `Mijoz ${i}` } });
      }

      const page = await listClients({ limit: 2, offset: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.total).toBe(5);
      expect(page.items.map((c) => c.name)).toEqual(['Mijoz 2', 'Mijoz 1']);
    });

    test('ro‘yxatda arizalar va o‘rnatishlar soni ko‘rsatiladi', async () => {
      const user = await prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz' } });
      const filter = await createFilter('osmos-5');
      await prisma.lead.create({
        data: { userId: user.id, phone: '+998901234567', source: 'WEB' },
      });
      await prisma.lead.create({
        data: { userId: user.id, phone: '+998901234567', source: 'MINIAPP' },
      });
      await prisma.installation.create({
        data: { userId: user.id, filterProductId: filter.id, installedAt: new Date() },
      });

      const result = await listClients({});

      expect(result.items[0]?.leadCount).toBe(2);
      expect(result.items[0]?.installationCount).toBe(1);
    });

    test('Telegram ID `bigint` bo‘lib qoladi — `number` da yaxlitlanib boshqa odamniki bo‘lardi', async () => {
      await prisma.user.create({ data: { telegramId: 9007199254740995n, name: 'Katta ID' } });

      const result = await listClients({});

      expect(result.items[0]?.telegramId).toBe(9007199254740995n);
    });
  });

  describe('getClientProfile', () => {
    test('mavjud bo‘lmagan mijoz uchun `null`', async () => {
      expect(await getClientProfile('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    test('BIR MIJOZDA BIR NECHTA O‘RNATISH: uy va dala hovli alohida ko‘rinadi (§5)', async () => {
      const user = await prisma.user.create({ data: { phone: '+998901234567', name: 'Aziz' } });
      const home = await createFilter('uy-filtri');
      const dacha = await createFilter('dala-filtri');

      await prisma.installation.create({
        data: {
          userId: user.id,
          filterProductId: home.id,
          installedAt: new Date('2026-01-10T00:00:00Z'),
          address: 'Toshkent, Chilonzor',
        },
      });
      await prisma.installation.create({
        data: {
          userId: user.id,
          filterProductId: dacha.id,
          installedAt: new Date('2026-03-20T00:00:00Z'),
          address: 'Bo‘stonliq',
        },
      });

      const profile = await getClientProfile(user.id);

      expect(profile?.installations).toHaveLength(2);
      // Eng yangi o'rnatish birinchi — menejer odatda oxirgisi bilan ishlaydi.
      expect(profile?.installations.map((i) => i.address)).toEqual([
        'Bo‘stonliq',
        'Toshkent, Chilonzor',
      ]);
      expect(profile?.installations[0]?.filterProduct.slug).toBe('dala-filtri');
    });

    test('profilda o‘rnatilgan kartrijlar va ularning muddatlari bo‘ladi', async () => {
      const user = await prisma.user.create({ data: { phone: '+998901234567' } });
      const filter = await createFilter('osmos-5');
      const cartridge = await prisma.product.create({
        data: {
          kind: 'CARTRIDGE',
          slug: 'membrana',
          nameUz: 'Membrana',
          nameRu: 'Мембрана',
          price: '50',
          cartridgeSpec: { create: { resourceMonths: 24 } },
        },
      });
      const installation = await prisma.installation.create({
        data: {
          userId: user.id,
          filterProductId: filter.id,
          installedAt: new Date('2026-01-10T00:00:00Z'),
        },
      });
      await prisma.installedPart.create({
        data: {
          installationId: installation.id,
          cartridgeProductId: cartridge.id,
          installedAt: new Date('2026-01-10T00:00:00Z'),
          dueAt: new Date('2028-01-10T00:00:00Z'),
        },
      });

      const profile = await getClientProfile(user.id);

      const parts = profile?.installations[0]?.parts ?? [];
      expect(parts).toHaveLength(1);
      expect(parts[0]?.cartridgeProduct.nameUz).toBe('Membrana');
      expect(parts[0]?.dueAt).toEqual(new Date('2028-01-10T00:00:00Z'));
    });

    test('profilda mijozning arizalari ko‘rinadi', async () => {
      const user = await prisma.user.create({ data: { phone: '+998901234567' } });
      await prisma.lead.create({
        data: {
          userId: user.id,
          phone: '+998901234567',
          source: 'WEB',
          comment: 'Qo‘ng‘iroq qiling',
        },
      });

      const profile = await getClientProfile(user.id);

      expect(profile?.leads).toHaveLength(1);
      expect(profile?.leads[0]?.comment).toBe('Qo‘ng‘iroq qiling');
    });
  });

  describe('registerClient', () => {
    test('menejer yangi mijozni telefon bo‘yicha qo‘shadi', async () => {
      const client = await registerClient({ phone: '90 123 45 67', name: 'Aziz' });

      expect(client.phone).toBe('+998901234567');
      expect(client.name).toBe('Aziz');
    });

    test('DUBLIKAT YARATILMAYDI: o‘sha raqam qayta kiritilsa mavjud mijoz qaytadi', async () => {
      const first = await registerClient({ phone: '+998901234567', name: 'Aziz' });
      const second = await registerClient({ phone: '901234567' });

      expect(second.id).toBe(first.id);
      expect(await prisma.user.count()).toBe(1);
    });

    test('Telegramdan kelgan mijoz bilan birlashadi — eslatmalar shunga bog‘liq', async () => {
      const tg = await prisma.user.create({ data: { telegramId: 555000111n } });

      const client = await registerClient({ phone: '+998901234567', telegramId: 555000111n });

      expect(client.id).toBe(tg.id);
      expect(client.phone).toBe('+998901234567');
      expect(await prisma.user.count()).toBe(1);
    });

    test('yaroqsiz telefon rad etiladi', async () => {
      await expect(registerClient({ phone: '12345' })).rejects.toThrow();
      expect(await prisma.user.count()).toBe(0);
    });
  });
});
