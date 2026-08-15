import type { Prisma } from '@/generated/prisma/client';
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

// ─────────────────────────────────────────────────────────────────────────────
// Admin panel: `activeOnly` YO'Q — arxivlanganlar ham ko'rinishi kerak,
// aks holda ularni qaytarib bo'lmasdi.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminProductFilter {
  kind?: 'FILTER' | 'CARTRIDGE' | undefined;
  query?: string | undefined;
}

function toAdminWhere(filter: AdminProductFilter): Prisma.ProductWhereInput {
  return {
    ...(filter.kind ? { kind: filter.kind } : {}),
    ...(filter.query
      ? {
          OR: [
            { slug: { contains: filter.query, mode: 'insensitive' } },
            { nameUz: { contains: filter.query, mode: 'insensitive' } },
            { nameRu: { contains: filter.query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export function findAdminProducts(
  filter: AdminProductFilter,
  page: { limit: number; offset: number },
) {
  return prisma.product.findMany({
    where: toAdminWhere(filter),
    orderBy: { updatedAt: 'desc' },
    take: page.limit,
    skip: page.offset,
    include: { cartridgeSpec: true },
  });
}

export function countAdminProducts(filter: AdminProductFilter): Promise<number> {
  return prisma.product.count({ where: toAdminWhere(filter) });
}

/** Tahrirlash ekrani uchun: mosliklar bilan birga. */
export function findProductForEdit(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      cartridgeSpec: true,
      compatibleFilters: { include: { filter: true } },
    },
  });
}
