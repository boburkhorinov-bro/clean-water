import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { prisma } from '@/server/db';
import { resetDatabase } from '@/test/db-helpers';
import {
  ProductValidationError,
  createProduct,
  listProductsForAdmin,
  setProductActive,
  updateProduct,
} from './admin-products';

/**
 * Admin panel: mahsulotlar CRUD (§7 dagi 5-band, §4.8, §6).
 *
 * Uchta narsa shu yerda hal bo'ladi va uchalasi ham panel tashqarisiga
 * chiqadi:
 *
 * 1. Kontent-bloklar SAQLASHDA tekshiriladi (§4.8) — chiqarishda emas.
 *    Bazadagi hamma narsa allaqachon ishonchli bo'lishi kerak.
 * 2. Kartrij resurssiz yozilmaydi: `due_at` usiz hisoblanmaydi va bunday
 *    kartrij eslatmasiz qolib ketardi (§5).
 * 3. Har bir harakat `AuditLog` ga tushadi (§6) va u asosiy amal bilan
 *    bitta tranzaksiyada — to'liq bo'lmagan jurnal jurnal emas.
 */
describe('admin: mahsulotlar CRUD', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createAdmin() {
    return prisma.user.create({
      data: { telegramId: 111000111n, name: 'Admin', role: 'ADMIN' },
    });
  }

  const filterInput = {
    kind: 'FILTER' as const,
    slug: 'osmos-5',
    nameUz: 'Osmos 5 bosqichli',
    nameRu: 'Осмос 5 ступеней',
    price: '2500000',
  };

  const cartridgeInput = {
    kind: 'CARTRIDGE' as const,
    slug: 'mexanik-kartrij',
    nameUz: 'Mexanik kartrij',
    nameRu: 'Механический картридж',
    price: '150000',
    resourceMonths: 6,
  };

  describe('createProduct', () => {
    test('filtr yaratiladi, ikkala tilda nom bilan', async () => {
      const admin = await createAdmin();

      const product = await createProduct(filterInput, admin.id);

      const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(stored.kind).toBe('FILTER');
      expect(stored.slug).toBe('osmos-5');
      expect(stored.nameUz).toBe('Osmos 5 bosqichli');
      expect(stored.nameRu).toBe('Осмос 5 ступеней');
      expect(stored.price.toString()).toBe('2500000');
      expect(stored.isActive).toBe(true);
    });

    test('ruscha nom bo‘sh bo‘lsa o‘zbekchasi yoziladi (§4.7)', async () => {
      const admin = await createAdmin();

      const product = await createProduct({ ...filterInput, nameRu: '' }, admin.id);

      expect(product.nameRu).toBe('Osmos 5 bosqichli');
    });

    test('kartrij resursi bilan yaratiladi', async () => {
      const admin = await createAdmin();

      const product = await createProduct(cartridgeInput, admin.id);

      const spec = await prisma.cartridgeSpec.findUniqueOrThrow({
        where: { productId: product.id },
      });
      expect(spec.resourceMonths).toBe(6);
    });

    test('RESURSSIZ KARTRIJ RAD ETILADI — u eslatmasiz qolib ketardi', async () => {
      const admin = await createAdmin();
      const withoutResource = {
        kind: 'CARTRIDGE' as const,
        slug: cartridgeInput.slug,
        nameUz: cartridgeInput.nameUz,
        nameRu: cartridgeInput.nameRu,
        price: cartridgeInput.price,
      };

      await expect(createProduct(withoutResource, admin.id)).rejects.toThrow(
        ProductValidationError,
      );
      expect(await prisma.product.count()).toBe(0);
    });

    test('nol yoki manfiy resurs rad etiladi', async () => {
      const admin = await createAdmin();

      await expect(
        createProduct({ ...cartridgeInput, resourceMonths: 0 }, admin.id),
      ).rejects.toThrow(ProductValidationError);
      await expect(
        createProduct({ ...cartridgeInput, resourceMonths: -6 }, admin.id),
      ).rejects.toThrow(ProductValidationError);
    });

    test('filtrga resurs berilsa rad etiladi — resurs kartrijga tegishli', async () => {
      const admin = await createAdmin();

      await expect(createProduct({ ...filterInput, resourceMonths: 6 }, admin.id)).rejects.toThrow(
        ProductValidationError,
      );
    });

    test('takroriy slug rad etiladi', async () => {
      const admin = await createAdmin();
      await createProduct(filterInput, admin.id);

      await expect(createProduct(filterInput, admin.id)).rejects.toThrow(ProductValidationError);
      expect(await prisma.product.count()).toBe(1);
    });

    test('slug formati tekshiriladi — u manzilga tushadi', async () => {
      const admin = await createAdmin();

      for (const slug of ['Osmos 5', 'osmos/5', 'осмос', '', 'osmos_5']) {
        await expect(
          createProduct({ ...filterInput, slug }, admin.id),
          `slug: ${slug}`,
        ).rejects.toThrow(ProductValidationError);
      }
    });

    test('yaroqsiz narx rad etiladi', async () => {
      const admin = await createAdmin();

      for (const price of ['-100', 'arzon', '']) {
        await expect(
          createProduct({ ...filterInput, price }, admin.id),
          `narx: ${price}`,
        ).rejects.toThrow(ProductValidationError);
      }
    });

    test('KONTENT-BLOKLAR SAQLASHDA tekshiriladi: tashqi rasm rad etiladi (§4.8)', async () => {
      const admin = await createAdmin();

      await expect(
        createProduct(
          {
            ...filterInput,
            contentBlocks: [{ type: 'image', src: 'javascript:alert(1)', alt: { uz: 'x' } }],
          },
          admin.id,
        ),
      ).rejects.toThrow(ProductValidationError);
      expect(await prisma.product.count()).toBe(0);
    });

    test('to‘g‘ri kontent-bloklar saqlanadi', async () => {
      const admin = await createAdmin();

      const product = await createProduct(
        {
          ...filterInput,
          contentBlocks: [
            { type: 'heading', uz: 'Xususiyatlari', ru: 'Характеристики' },
            { type: 'image', src: '/media/osmos-5.jpg', alt: { uz: 'Osmos 5' } },
          ],
        },
        admin.id,
      );

      const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(Array.isArray(stored.contentBlocks)).toBe(true);
      expect((stored.contentBlocks as unknown[]).length).toBe(2);
    });

    test('rasm manzillari `/media/` bilan cheklanadi', async () => {
      const admin = await createAdmin();

      await expect(
        createProduct({ ...filterInput, images: ['https://tashqi.example/a.jpg'] }, admin.id),
      ).rejects.toThrow(ProductValidationError);
    });

    test('video id formati tekshiriladi — u iframe manziliga tushadi', async () => {
      const admin = await createAdmin();

      await expect(
        createProduct({ ...filterInput, videoId: '"><script>' }, admin.id),
      ).rejects.toThrow(ProductValidationError);
    });

    test('kartrij mosligi yoziladi', async () => {
      const admin = await createAdmin();
      const filter = await createProduct(filterInput, admin.id);

      const cartridge = await createProduct(
        { ...cartridgeInput, compatibleFilterIds: [filter.id], stage: 1 },
        admin.id,
      );

      const links = await prisma.compatibility.findMany({
        where: { cartridgeId: cartridge.id },
      });
      expect(links).toHaveLength(1);
      expect(links[0]?.filterId).toBe(filter.id);
      expect(links[0]?.stage).toBe(1);
    });

    test('mavjud bo‘lmagan filtrga moslik rad etiladi va mahsulot yozilmaydi', async () => {
      const admin = await createAdmin();

      await expect(
        createProduct(
          {
            ...cartridgeInput,
            compatibleFilterIds: ['00000000-0000-0000-0000-000000000000'],
          },
          admin.id,
        ),
      ).rejects.toThrow(ProductValidationError);
      expect(await prisma.product.count()).toBe(0);
      expect(await prisma.compatibility.count()).toBe(0);
    });

    test('AUDIT: yaratish jurnalga tushadi', async () => {
      const admin = await createAdmin();

      const product = await createProduct(filterInput, admin.id);

      const log = await prisma.auditLog.findFirstOrThrow();
      expect(log.adminId).toBe(admin.id);
      expect(log.action).toBe('product.create');
      expect(log.entity).toBe(`Product:${product.id}`);
      expect(log.payload).toMatchObject({ slug: 'osmos-5' });
    });

    test('ATOMARLIK: xato bo‘lsa jurnalga ham yozilmaydi', async () => {
      const admin = await createAdmin();

      await expect(
        createProduct({ ...cartridgeInput, resourceMonths: 0 }, admin.id),
      ).rejects.toThrow(ProductValidationError);

      expect(await prisma.auditLog.count()).toBe(0);
    });
  });

  describe('updateProduct', () => {
    test('nom va narx yangilanadi', async () => {
      const admin = await createAdmin();
      const product = await createProduct(filterInput, admin.id);

      await updateProduct(product.id, { nameUz: 'Yangi nom', price: '3000000' }, admin.id);

      const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(stored.nameUz).toBe('Yangi nom');
      expect(stored.price.toString()).toBe('3000000');
      // Tegilmagan maydon o'zgarmaydi.
      expect(stored.nameRu).toBe('Осмос 5 ступеней');
    });

    test('kartrij resursi yangilanadi', async () => {
      const admin = await createAdmin();
      const cartridge = await createProduct(cartridgeInput, admin.id);

      await updateProduct(cartridge.id, { resourceMonths: 12 }, admin.id);

      const spec = await prisma.cartridgeSpec.findUniqueOrThrow({
        where: { productId: cartridge.id },
      });
      expect(spec.resourceMonths).toBe(12);
    });

    test('moslik ro‘yxati almashtiriladi, qo‘shilmaydi', async () => {
      const admin = await createAdmin();
      const first = await createProduct(filterInput, admin.id);
      const second = await createProduct({ ...filterInput, slug: 'osmos-6' }, admin.id);
      const cartridge = await createProduct(
        { ...cartridgeInput, compatibleFilterIds: [first.id] },
        admin.id,
      );

      await updateProduct(cartridge.id, { compatibleFilterIds: [second.id] }, admin.id);

      const links = await prisma.compatibility.findMany({ where: { cartridgeId: cartridge.id } });
      expect(links).toHaveLength(1);
      expect(links[0]?.filterId).toBe(second.id);
    });

    test('mavjud bo‘lmagan mahsulot rad etiladi', async () => {
      const admin = await createAdmin();

      await expect(
        updateProduct('00000000-0000-0000-0000-000000000000', { nameUz: 'x' }, admin.id),
      ).rejects.toThrow(ProductValidationError);
    });

    test('boshqa mahsulotning slugi bilan to‘qnashuv rad etiladi', async () => {
      const admin = await createAdmin();
      await createProduct(filterInput, admin.id);
      const second = await createProduct({ ...filterInput, slug: 'osmos-6' }, admin.id);

      await expect(updateProduct(second.id, { slug: 'osmos-5' }, admin.id)).rejects.toThrow(
        ProductValidationError,
      );
    });

    test('AUDIT: o‘zgarish jurnalga tushadi', async () => {
      const admin = await createAdmin();
      const product = await createProduct(filterInput, admin.id);

      await updateProduct(product.id, { nameUz: 'Yangi nom' }, admin.id);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'product.update' },
      });
      expect(log.entity).toBe(`Product:${product.id}`);
      expect(log.payload).toMatchObject({ nameUz: 'Yangi nom' });
    });
  });

  describe('setProductActive', () => {
    test('ARXIVLASH: mahsulot katalogdan yo‘qoladi, lekin o‘chirilmaydi', async () => {
      const admin = await createAdmin();
      const product = await createProduct(filterInput, admin.id);

      await setProductActive(product.id, false, admin.id);

      const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(stored.isActive).toBe(false);
      // Yozuv joyida: unga bog'langan o'rnatishlar va arizalar tarixi buzilmaydi.
      expect(await prisma.product.count()).toBe(1);
    });

    test('arxivlangan mahsulot qayta faollashtiriladi', async () => {
      const admin = await createAdmin();
      const product = await createProduct(filterInput, admin.id);
      await setProductActive(product.id, false, admin.id);

      await setProductActive(product.id, true, admin.id);

      const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(stored.isActive).toBe(true);
    });

    test('AUDIT: arxivlash jurnalga tushadi', async () => {
      const admin = await createAdmin();
      const product = await createProduct(filterInput, admin.id);

      await setProductActive(product.id, false, admin.id);

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'product.archive' } });
      expect(log.entity).toBe(`Product:${product.id}`);
    });
  });

  describe('listProductsForAdmin', () => {
    test('ARXIVLANGANLAR HAM ko‘rinadi — aks holda ularni tiklab bo‘lmasdi', async () => {
      const admin = await createAdmin();
      const product = await createProduct(filterInput, admin.id);
      await createProduct({ ...filterInput, slug: 'osmos-6' }, admin.id);
      await setProductActive(product.id, false, admin.id);

      const result = await listProductsForAdmin({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('tur bo‘yicha filtrlanadi', async () => {
      const admin = await createAdmin();
      await createProduct(filterInput, admin.id);
      await createProduct(cartridgeInput, admin.id);

      const result = await listProductsForAdmin({ kind: 'CARTRIDGE' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.slug).toBe('mexanik-kartrij');
    });

    test('nom yoki slug bo‘yicha qidiriladi', async () => {
      const admin = await createAdmin();
      await createProduct(filterInput, admin.id);
      await createProduct(cartridgeInput, admin.id);

      const result = await listProductsForAdmin({ query: 'mexanik' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.slug).toBe('mexanik-kartrij');
    });

    test('kartrij resursi ro‘yxatda ko‘rinadi', async () => {
      const admin = await createAdmin();
      await createProduct(cartridgeInput, admin.id);

      const result = await listProductsForAdmin({ kind: 'CARTRIDGE' });

      expect(result.items[0]?.resourceMonths).toBe(6);
    });
  });
});
