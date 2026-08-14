import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Ishlab chiqish uchun demo ma'lumot.
 *
 * DIQQAT: bu haqiqiy katalog emas. Haqiqiy kontent (3–5 filtr modeli, foto,
 * narx, ikki tilda tavsif, kartrijlar resursi) loyiha egasi zimmasida —
 * TZ §7 «Kritik yo'l», 1-punkt.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL o‘rnatilmagan. env.example dan .env yarating.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const filter = await prisma.product.upsert({
    where: { slug: 'demo-osmos-5' },
    update: {},
    create: {
      kind: 'FILTER',
      slug: 'demo-osmos-5',
      nameUz: 'Demo Osmos 5 bosqichli',
      nameRu: 'Демо Осмос 5 ступеней',
      price: '2500000',
      contentBlocks: [
        { type: 'heading', uz: 'Demo filtr', ru: 'Демо фильтр' },
        {
          type: 'paragraph',
          uz: 'Bu seed ma’lumoti. Haqiqiy tavsif admin panel orqali kiritiladi.',
          ru: 'Это seed-данные. Реальное описание вносится через админку.',
        },
      ],
    },
  });

  // Resurs muddatlari §3 dan: mexanika/ko'mir ≈ 6 oy, membrana ≈ 24 oy,
  // postfiltr ≈ 12 oy. Yagona taymer noto'g'ri eslatma yuborardi.
  const cartridges = [
    {
      slug: 'demo-kartrij-mexanik',
      uz: 'Mexanik kartrij',
      ru: 'Механический картридж',
      months: 6,
      price: '120000',
    },
    {
      slug: 'demo-kartrij-membrana',
      uz: 'RO membrana',
      ru: 'RO мембрана',
      months: 24,
      price: '450000',
    },
    {
      slug: 'demo-kartrij-postfiltr',
      uz: 'Postfiltr',
      ru: 'Постфильтр',
      months: 12,
      price: '150000',
    },
  ];

  for (const c of cartridges) {
    const product = await prisma.product.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        kind: 'CARTRIDGE',
        slug: c.slug,
        nameUz: c.uz,
        nameRu: c.ru,
        price: c.price,
        cartridgeSpec: { create: { resourceMonths: c.months } },
      },
    });

    await prisma.compatibility.upsert({
      where: { cartridgeId_filterId: { cartridgeId: product.id, filterId: filter.id } },
      update: {},
      create: { cartridgeId: product.id, filterId: filter.id },
    });
  }

  console.log(`Seed tayyor: 1 filtr, ${cartridges.length} kartrij.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
