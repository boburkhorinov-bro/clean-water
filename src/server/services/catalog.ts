import type { Product } from '@/generated/prisma/client';
import { type ContentBlock, parseContentBlocks } from '@/lib/content-blocks';
import {
  findCartridgesCompatibleWith,
  findProductBySlug,
  findProductsByKind,
} from '@/server/repositories/product-repository';

/**
 * Katalog biznes-mantiqi (§4.2).
 *
 * Bu qatlam veb, Mini App va admin paneldan chaqiriladi va uchalasida bir xil
 * ishlashi kerak. Shu sababli Prisma tiplari to'g'ridan-to'g'ri UI ga
 * uzatilmaydi: narx satrga, `content_blocks` esa tekshirilgan bloklarga
 * aylantiriladi.
 */

export interface CatalogProduct {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  /** §4.10: pul Decimal da saqlanadi; UI ga satr sifatida beriladi. */
  price: string;
  images: string[];
  videoId: string | null;
  contentBlocks: ContentBlock[];
  kind: 'FILTER' | 'CARTRIDGE';
  /** Faqat kartrijlarda: almashtirish resursi, oyda (§4.6). */
  resourceMonths: number | null;
}

type ProductRow = Product & { cartridgeSpec?: { resourceMonths: number } | null };

function toCatalogProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    slug: row.slug,
    nameUz: row.nameUz,
    nameRu: row.nameRu,
    price: row.price.toString(),
    images: row.images,
    videoId: row.videoId,
    contentBlocks: parseContentBlocks(row.contentBlocks),
    kind: row.kind,
    resourceMonths: row.cartridgeSpec?.resourceMonths ?? null,
  };
}

export async function listFilters(): Promise<CatalogProduct[]> {
  const rows = await findProductsByKind('FILTER');
  return rows.map(toCatalogProduct);
}

export async function listCartridges(): Promise<CatalogProduct[]> {
  const rows = await findProductsByKind('CARTRIDGE');
  return rows.map(toCatalogProduct);
}

export async function getFilterBySlug(slug: string): Promise<CatalogProduct | null> {
  const row = await findProductBySlug(slug, 'FILTER');
  return row ? toCatalogProduct(row) : null;
}

export async function getCartridgeBySlug(slug: string): Promise<CatalogProduct | null> {
  const row = await findProductBySlug(slug, 'CARTRIDGE');
  return row ? toCatalogProduct(row) : null;
}

/**
 * Filtrning tozalash bosqichlari (§3).
 *
 * `stage` — haqiqiy ma'lumot: mexanik → ko'mir → membrana. U berilmagan
 * bo'lsa `null` qaytadi va kartochka raqamsiz ro'yxat chizadi. O'ylab
 * topilgan tartibni ko'rsatish — aynan §3 rad etgan dekorativ narsa.
 */
export interface FilterStage extends CatalogProduct {
  stage: number | null;
}

export async function getCartridgesForFilter(filterId: string): Promise<FilterStage[]> {
  const rows = await findCartridgesCompatibleWith(filterId);
  return rows.map((row) => ({ ...toCatalogProduct(row.cartridge), stage: row.stage }));
}
