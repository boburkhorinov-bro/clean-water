import type { InstalledPart, Prisma } from '@/generated/prisma/client';
import { computeDueAt } from '@/lib/due-date';
import { prisma } from '@/server/db';
import {
  findInstallationById,
  installationInclude,
} from '@/server/repositories/installation-repository';

/**
 * CRM: o'rnatishlarni qayd qilish (§7 dagi 6-band).
 *
 * Butun eslatmalar tizimi shu yerda yozilgan ma'lumotga tayanadi. Shuning
 * uchun qoida qat'iy: har bir kartrijning muddati AYNAN O'SHA kartrij
 * o'rnatilgan sanadan va AYNAN O'SHA modelning resursidan hisoblanadi (§5).
 * Resursi noma'lum kartrijni yozib bo'lmaydi — u eslatmasiz qolib ketardi.
 */

export class InstallationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstallationError';
  }
}

export interface InstalledPartInput {
  cartridgeProductId: string;
  /** Ko'rsatilmasa apparat o'rnatilgan sana olinadi. */
  installedAt?: Date | undefined;
}

export interface RegisterInstallationInput {
  userId: string;
  filterProductId: string;
  installedAt: Date;
  address?: string | undefined;
  note?: string | undefined;
  parts: InstalledPartInput[];
}

export type InstallationWithParts = NonNullable<Awaited<ReturnType<typeof findInstallationById>>>;

type CartridgeWithSpec = Prisma.ProductGetPayload<{ include: { cartridgeSpec: true } }>;

function assertValidDate(date: Date, label: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new InstallationError(`${label} yaroqsiz`);
  }
}

/**
 * Kartrijning resursini oladi va uni yozishga yaroqliligini tekshiradi.
 *
 * Mosligi (`Compatibility`) ataylab tekshirilmaydi: bu jadval admin tomonidan
 * to'ldiriladi va to'liqmasligi mumkin, usta esa haqiqatda qo'yilgan kartrijni
 * yozishi kerak. To'sib qo'yish ma'lumotni haqiqatdan uzoqlashtirardi.
 */
function resourceMonthsOf(cartridge: CartridgeWithSpec | undefined, id: string): number {
  if (!cartridge) {
    throw new InstallationError(`Kartrij topilmadi: ${id}`);
  }
  if (cartridge.kind !== 'CARTRIDGE') {
    throw new InstallationError(`Bu mahsulot kartrij emas: ${cartridge.slug}`);
  }
  if (!cartridge.cartridgeSpec) {
    throw new InstallationError(
      `Kartrijning resursi ko‘rsatilmagan: ${cartridge.slug}. ` +
        'Resurssiz kartrij almashtirish muddatini olmaydi.',
    );
  }
  return cartridge.cartridgeSpec.resourceMonths;
}

function toPartRows(
  installationId: string,
  parts: InstalledPartInput[],
  fallbackInstalledAt: Date,
  cartridges: Map<string, CartridgeWithSpec>,
): Prisma.InstalledPartCreateManyInput[] {
  return parts.map((part) => {
    const installedAt = part.installedAt ?? fallbackInstalledAt;
    assertValidDate(installedAt, 'Kartrij o‘rnatilgan sana');

    const resourceMonths = resourceMonthsOf(
      cartridges.get(part.cartridgeProductId),
      part.cartridgeProductId,
    );

    return {
      installationId,
      cartridgeProductId: part.cartridgeProductId,
      installedAt,
      dueAt: computeDueAt(installedAt, resourceMonths),
    };
  });
}

export async function registerInstallation(
  input: RegisterInstallationInput,
): Promise<InstallationWithParts> {
  assertValidDate(input.installedAt, 'O‘rnatish sanasi');

  const installation = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!user) {
      throw new InstallationError(`Mijoz topilmadi: ${input.userId}`);
    }

    const filter = await tx.product.findUnique({
      where: { id: input.filterProductId },
      select: { id: true, kind: true, slug: true },
    });
    if (!filter) {
      throw new InstallationError(`Apparat topilmadi: ${input.filterProductId}`);
    }
    if (filter.kind !== 'FILTER') {
      throw new InstallationError(`Bu mahsulot filtr emas: ${filter.slug}`);
    }

    const cartridgeIds = [...new Set(input.parts.map((part) => part.cartridgeProductId))];
    const cartridges = await tx.product.findMany({
      where: { id: { in: cartridgeIds } },
      include: { cartridgeSpec: true },
    });
    const byId = new Map(cartridges.map((cartridge) => [cartridge.id, cartridge]));

    const created = await tx.installation.create({
      data: {
        userId: input.userId,
        filterProductId: input.filterProductId,
        installedAt: input.installedAt,
        address: input.address ?? null,
        note: input.note ?? null,
      },
    });

    // Muddatlar shu yerda hisoblanadi: xato chiqsa tranzaksiya butunlay
    // qaytariladi va yarim yozilgan o'rnatish qolmaydi.
    const rows = toPartRows(created.id, input.parts, input.installedAt, byId);
    if (rows.length > 0) {
      await tx.installedPart.createMany({ data: rows });
    }

    return tx.installation.findUniqueOrThrow({
      where: { id: created.id },
      include: installationInclude,
    });
  });

  return installation;
}

export interface ReplacePartInput {
  installedPartId: string;
  replacedAt: Date;
  /** Boshqa modelga almashtirilgan bo'lsa. Ko'rsatilmasa o'sha model qayta qo'yiladi. */
  cartridgeProductId?: string | undefined;
}

export interface ReplacementResult {
  /** Yopilgan qator — tarix uchun qoladi. */
  replaced: InstalledPart;
  /** Yangi kartrij va uning yangi muddati. */
  next: InstalledPart;
}

/**
 * Kartrij almashtirilganini belgilaydi va keyingi muddatni hisoblaydi.
 *
 * Eski qator YOPILADI, o'rniga YANGISI yaratiladi. Nega qator qayta
 * ishlatilmaydi: eslatmalar idempotentligi `(installed_part_id, kind)` unikal
 * indeksiga tayanadi (§4.6) — bir qatorni qayta ishlatsak, keyingi sikl uchun
 * eslatmalar dublikat sifatida rad etilib, mijozga umuman yetib bormasdi.
 *
 * Keyingi `due_at` almashtirish sanasidan hisoblanadi, eski `due_at` dan emas:
 * mijoz kechikib almashtirsa, yangi kartrij o'sha kundan ishlay boshlaydi.
 */
export async function markPartReplaced(input: ReplacePartInput): Promise<ReplacementResult> {
  assertValidDate(input.replacedAt, 'Almashtirish sanasi');

  return prisma.$transaction(async (tx) => {
    const part = await tx.installedPart.findUnique({
      where: { id: input.installedPartId },
      include: { cartridgeProduct: { include: { cartridgeSpec: true } } },
    });
    if (!part) {
      throw new InstallationError(`O‘rnatilgan kartrij topilmadi: ${input.installedPartId}`);
    }
    if (part.replacedAt) {
      throw new InstallationError(
        'Bu kartrij allaqachon almashtirilgan. Amaldagi kartrijni almashtiring.',
      );
    }
    if (input.replacedAt.getTime() < part.installedAt.getTime()) {
      throw new InstallationError(
        'Almashtirish sanasi kartrij o‘rnatilgan sanadan oldin bo‘lishi mumkin emas.',
      );
    }

    const nextCartridgeId = input.cartridgeProductId ?? part.cartridgeProductId;
    const nextCartridge =
      nextCartridgeId === part.cartridgeProductId
        ? part.cartridgeProduct
        : ((await tx.product.findUnique({
            where: { id: nextCartridgeId },
            include: { cartridgeSpec: true },
          })) ?? undefined);

    const resourceMonths = resourceMonthsOf(nextCartridge, nextCartridgeId);

    const replaced = await tx.installedPart.update({
      where: { id: part.id },
      data: { replacedAt: input.replacedAt },
    });

    const next = await tx.installedPart.create({
      data: {
        installationId: part.installationId,
        cartridgeProductId: nextCartridgeId,
        installedAt: input.replacedAt,
        dueAt: computeDueAt(input.replacedAt, resourceMonths),
      },
    });

    return { replaced, next };
  });
}
