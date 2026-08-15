import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db';

/**
 * CRM dagi mijozlarga kirish (§4.2 — repositories qatlami).
 *
 * Bu yerda faqat so'rovlar. Qidiruv satrini qanday tushunish (telefonmi, ismmi)
 * — biznes qarori va u `services/clients.ts` da.
 */

/** Qidiruv satri servis tomonidan ajratilgan holda keladi. */
export interface ClientFilter {
  /** Normallashtirilgan to'liq raqam — aniq mos kelish. */
  phoneExact?: string | undefined;
  /** Raqam bo'lagi (menejer oxirgi raqamlarni eslaydi). */
  phoneFragment?: string | undefined;
  nameFragment?: string | undefined;
}

function toWhere(filter: ClientFilter): Prisma.UserWhereInput {
  const or: Prisma.UserWhereInput[] = [];

  if (filter.phoneExact) or.push({ phone: filter.phoneExact });
  if (filter.phoneFragment) or.push({ phone: { contains: filter.phoneFragment } });
  if (filter.nameFragment)
    or.push({ name: { contains: filter.nameFragment, mode: 'insensitive' } });

  return or.length > 0 ? { OR: or } : {};
}

export function findClients(filter: ClientFilter, page: { limit: number; offset: number }) {
  return prisma.user.findMany({
    where: toWhere(filter),
    orderBy: { createdAt: 'desc' },
    take: page.limit,
    skip: page.offset,
    include: { _count: { select: { leads: true, installations: true } } },
  });
}

export function countClients(filter: ClientFilter): Promise<number> {
  return prisma.user.count({ where: toWhere(filter) });
}

/**
 * Mijoz kartochkasi uchun to'liq tarix.
 *
 * O'rnatishlar va kartrijlar bitta so'rovda olinadi: menejer kartochkani
 * ochganda darhol «qaysi apparat, qaysi kartrij, qachon almashtiriladi»
 * savoliga javob kerak.
 */
export function findClientWithHistory(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      installations: {
        orderBy: { installedAt: 'desc' },
        include: {
          filterProduct: true,
          parts: {
            orderBy: { dueAt: 'asc' },
            include: { cartridgeProduct: { include: { cartridgeSpec: true } } },
          },
        },
      },
      leads: { orderBy: { createdAt: 'desc' }, include: { product: true } },
    },
  });
}

/**
 * Administrator harakatlari jurnali (§6).
 *
 * Jurnal faqat O'QILADI: unga yozish `services/audit.ts` orqali, asosiy amal
 * bilan bitta tranzaksiyada bo'ladi.
 */
export function findAuditLogs(page: { limit: number; offset: number }) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: page.limit,
    skip: page.offset,
    include: { admin: { select: { name: true, telegramId: true } } },
  });
}

export function countAuditLogs(): Promise<number> {
  return prisma.auditLog.count();
}
