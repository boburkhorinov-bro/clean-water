import { z } from 'zod';
import type { Prisma, Product } from '@/generated/prisma/client';
import { contentBlocksSchema } from '@/lib/content-blocks';
import { prisma } from '@/server/db';
import {
  countAdminProducts,
  findAdminProducts,
  type AdminProductFilter,
} from '@/server/repositories/product-repository';
import { recordAudit } from './audit';

/**
 * Admin panel: mahsulotlar CRUD (§7 dagi 5-band).
 *
 * Bu qatlam katalogning yagona kirish nuqtasi, shuning uchun tekshiruvlar
 * ham shu yerda:
 *
 * — kontent-bloklar SAQLASHDA validatsiya qilinadi (§4.8), chiqarishda emas;
 * — kartrij resurssiz yozilmaydi: `due_at` usiz hisoblanmaydi va bunday
 *   kartrij eslatmasiz qolib ketardi (§5);
 * — har bir harakat `AuditLog` ga asosiy amal bilan BITTA tranzaksiyada
 *   tushadi (§6): to'liq bo'lmagan jurnal jurnal emas.
 */

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductValidationError';
  }
}

/** Slug manzilga tushadi: faqat kichik harf, raqam va chiziqcha. */
const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug faqat kichik harf, raqam va `-` dan iborat');

/** Narx so'mda, kasr qismi ikki xonagacha. Manfiy narx yo'q. */
const priceSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Narx musbat son bo‘lishi kerak');

/** Rasm faqat o'z serverimizdan — `content-blocks.ts` dagi qoida bilan bir xil. */
const mediaPathSchema = z
  .string()
  .regex(/^\/media\/[\w./-]+$/, 'Rasm faqat /media/ ichidan bo‘lishi mumkin')
  .refine((value) => !value.includes('..'), 'Papkadan chiqish taqiqlanadi');

/** Bu qiymat Kinescope iframe manziliga tushadi. */
const videoIdSchema = z.string().regex(/^[\w-]+$/, 'Video id da faqat harf, raqam, `-` va `_`');

const baseFields = {
  slug: slugSchema,
  nameUz: z.string().trim().min(1).max(200),
  nameRu: z.string().trim().max(200).optional(),
  price: priceSchema,
  images: z.array(mediaPathSchema).max(20).optional(),
  videoId: videoIdSchema.nullish(),
  contentBlocks: contentBlocksSchema.optional(),
  isActive: z.boolean().optional(),
  /** Faqat kartrij uchun. */
  resourceMonths: z.number().int().positive().optional(),
  /** Faqat kartrij uchun: mos filtrlar. */
  compatibleFilterIds: z.array(z.uuid()).optional(),
  /** Tozalash bosqichi tartibi (§3). */
  stage: z.number().int().positive().nullish(),
};

const createSchema = z
  .object({ kind: z.enum(['FILTER', 'CARTRIDGE']), ...baseFields })
  .superRefine((value, ctx) => {
    if (value.kind === 'CARTRIDGE' && value.resourceMonths === undefined) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Kartrij resursi ko‘rsatilishi shart: usiz almashtirish muddati hisoblanmaydi ' +
          'va kartrij eslatmasiz qoladi.',
      });
    }
    if (value.kind === 'FILTER' && value.resourceMonths !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'Resurs faqat kartrijga tegishli' });
    }
  });

const updateSchema = z.object({ ...baseFields }).partial();

export type CreateProductInput = z.input<typeof createSchema>;
export type UpdateProductInput = z.input<typeof updateSchema>;

function parseOrThrow<T>(
  schema: { safeParse: (v: unknown) => z.ZodSafeParseResult<T> },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new ProductValidationError(message);
  }
  return parsed.data;
}

/** §4.7: ruscha nom bo'sh bo'lsa o'zbekchasiga tushadi — bo'shliq ko'rsatilmaydi. */
function resolveNameRu(nameRu: string | undefined, nameUz: string): string {
  return nameRu && nameRu.trim().length > 0 ? nameRu : nameUz;
}

/** Mosliklar yozilishidan oldin filtrlar haqiqatan mavjudligiga ishonch. */
async function assertFiltersExist(
  tx: Prisma.TransactionClient,
  filterIds: string[],
): Promise<void> {
  if (filterIds.length === 0) return;

  const found = await tx.product.findMany({
    where: { id: { in: filterIds }, kind: 'FILTER' },
    select: { id: true },
  });

  if (found.length !== new Set(filterIds).size) {
    throw new ProductValidationError('Mos filtrlardan ba’zilari topilmadi');
  }
}

export async function createProduct(input: CreateProductInput, adminId: string): Promise<Product> {
  const data = parseOrThrow(createSchema, input);

  const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
  if (existing) {
    throw new ProductValidationError(`Bunday slug band: ${data.slug}`);
  }

  return prisma.$transaction(async (tx) => {
    await assertFiltersExist(tx, data.compatibleFilterIds ?? []);

    const product = await tx.product.create({
      data: {
        kind: data.kind,
        slug: data.slug,
        nameUz: data.nameUz,
        nameRu: resolveNameRu(data.nameRu, data.nameUz),
        price: data.price,
        images: data.images ?? [],
        videoId: data.videoId ?? null,
        contentBlocks: data.contentBlocks ?? [],
        isActive: data.isActive ?? true,
        ...(data.resourceMonths !== undefined
          ? { cartridgeSpec: { create: { resourceMonths: data.resourceMonths } } }
          : {}),
      },
    });

    if (data.compatibleFilterIds?.length) {
      await tx.compatibility.createMany({
        data: data.compatibleFilterIds.map((filterId) => ({
          cartridgeId: product.id,
          filterId,
          stage: data.stage ?? null,
        })),
      });
    }

    await recordAudit(tx, {
      adminId,
      action: 'product.create',
      entity: `Product:${product.id}`,
      payload: { kind: data.kind, slug: data.slug, nameUz: data.nameUz },
    });

    return product;
  });
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  adminId: string,
): Promise<Product> {
  const data = parseOrThrow(updateSchema, input);

  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) {
    throw new ProductValidationError(`Mahsulot topilmadi: ${id}`);
  }

  if (data.slug && data.slug !== current.slug) {
    const clash = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (clash) throw new ProductValidationError(`Bunday slug band: ${data.slug}`);
  }

  if (data.resourceMonths !== undefined && current.kind !== 'CARTRIDGE') {
    throw new ProductValidationError('Resurs faqat kartrijga tegishli');
  }

  return prisma.$transaction(async (tx) => {
    await assertFiltersExist(tx, data.compatibleFilterIds ?? []);

    const product = await tx.product.update({
      where: { id },
      data: {
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.nameUz !== undefined ? { nameUz: data.nameUz } : {}),
        ...(data.nameRu !== undefined
          ? { nameRu: resolveNameRu(data.nameRu, data.nameUz ?? current.nameUz) }
          : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.images !== undefined ? { images: data.images } : {}),
        ...(data.videoId !== undefined ? { videoId: data.videoId } : {}),
        ...(data.contentBlocks !== undefined ? { contentBlocks: data.contentBlocks } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (data.resourceMonths !== undefined) {
      await tx.cartridgeSpec.upsert({
        where: { productId: id },
        create: { productId: id, resourceMonths: data.resourceMonths },
        update: { resourceMonths: data.resourceMonths },
      });
    }

    // Moslik ro'yxati ALMASHTIRILADI: admin ekranda to'liq ro'yxatni ko'radi
    // va uni tahrirlaydi, ya'ni yuborilgan ro'yxat yakuniy holat.
    if (data.compatibleFilterIds !== undefined) {
      await tx.compatibility.deleteMany({ where: { cartridgeId: id } });
      if (data.compatibleFilterIds.length > 0) {
        await tx.compatibility.createMany({
          data: data.compatibleFilterIds.map((filterId) => ({
            cartridgeId: id,
            filterId,
            stage: data.stage ?? null,
          })),
        });
      }
    }

    await recordAudit(tx, {
      adminId,
      action: 'product.update',
      entity: `Product:${id}`,
      payload: data,
    });

    return product;
  });
}

/**
 * Mahsulotni arxivlaydi yoki qaytaradi.
 *
 * Haqiqiy o'chirish YO'Q: mahsulotga `Lead` va `Installation` bog'langan
 * bo'lishi mumkin va ularning tarixi buzilmasligi kerak. Katalog esa baribir
 * faqat `isActive: true` ni ko'rsatadi.
 */
export async function setProductActive(
  id: string,
  isActive: boolean,
  adminId: string,
): Promise<Product> {
  const current = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    throw new ProductValidationError(`Mahsulot topilmadi: ${id}`);
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: { isActive } });

    await recordAudit(tx, {
      adminId,
      action: isActive ? 'product.restore' : 'product.archive',
      entity: `Product:${id}`,
      payload: { isActive },
    });

    return product;
  });
}

export interface AdminProductListItem {
  id: string;
  kind: 'FILTER' | 'CARTRIDGE';
  slug: string;
  nameUz: string;
  nameRu: string;
  price: string;
  isActive: boolean;
  resourceMonths: number | null;
  updatedAt: Date;
}

export interface ListAdminProductsParams {
  kind?: 'FILTER' | 'CARTRIDGE' | undefined;
  query?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Admin ro'yxati katalogdan farq qiladi: arxivlanganlar ham ko'rinadi.
 * Aks holda arxivlangan mahsulotni qaytarib bo'lmasdi.
 */
export async function listProductsForAdmin(
  params: ListAdminProductsParams,
): Promise<{ items: AdminProductListItem[]; total: number }> {
  const filter: AdminProductFilter = {
    kind: params.kind,
    query: params.query?.trim() || undefined,
  };
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  const [rows, total] = await Promise.all([
    findAdminProducts(filter, { limit, offset }),
    countAdminProducts(filter),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      slug: row.slug,
      nameUz: row.nameUz,
      nameRu: row.nameRu,
      price: row.price.toString(),
      isActive: row.isActive,
      resourceMonths: row.cartridgeSpec?.resourceMonths ?? null,
      updatedAt: row.updatedAt,
    })),
    total,
  };
}
