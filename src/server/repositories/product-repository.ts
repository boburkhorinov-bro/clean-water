import { prisma } from '@/server/db';

/**
 * Mahsulotlarga kirish (§4.2 — repositories qatlami).
 *
 * Bu yerda faqat so'rovlar; qaror va shakllantirish `services/` da.
 */

/** Katalogda faqat faol mahsulotlar ko'rinadi. */
const activeOnly = { isActive: true } as const;

export function findProductsByKind(kind: 'FILTER' | 'CARTRIDGE') {
  return prisma.product.findMany({
    where: { kind, ...activeOnly },
    include: { cartridgeSpec: true },
    orderBy: { nameUz: 'asc' },
  });
}

export function findProductBySlug(slug: string, kind: 'FILTER' | 'CARTRIDGE') {
  return prisma.product.findFirst({
    where: { slug, kind, ...activeOnly },
    include: { cartridgeSpec: true },
  });
}

/**
 * Berilgan filtrga mos, faol kartrijlar (§2 — moslik).
 *
 * So'rov `Compatibility` dan boshlanadi, chunki bosqich tartibi (`stage`)
 * aynan shu jadvalda. Tartibsiz mosliklar oxirida keladi: PostgreSQL da
 * `ASC` uchun `NULL` lar oxirgi.
 */
export function findCartridgesCompatibleWith(filterId: string) {
  return prisma.compatibility.findMany({
    where: { filterId, cartridge: activeOnly },
    include: { cartridge: { include: { cartridgeSpec: true } } },
    orderBy: [{ stage: 'asc' }, { cartridge: { nameUz: 'asc' } }],
  });
}
