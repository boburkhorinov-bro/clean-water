import type { LeadStatus, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db';

/**
 * Arizalarga kirish (§4.2 — repositories qatlami).
 *
 * Qidiruv satrini qanday tushunish — biznes qarori va u
 * `services/admin-leads.ts` da.
 */

export interface LeadFilter {
  status?: LeadStatus | undefined;
  phoneExact?: string | undefined;
  phoneFragment?: string | undefined;
  nameFragment?: string | undefined;
}

function toWhere(filter: LeadFilter): Prisma.LeadWhereInput {
  const or: Prisma.LeadWhereInput[] = [];

  if (filter.phoneExact) or.push({ phone: filter.phoneExact });
  if (filter.phoneFragment) or.push({ phone: { contains: filter.phoneFragment } });
  if (filter.nameFragment)
    or.push({ name: { contains: filter.nameFragment, mode: 'insensitive' } });

  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(or.length > 0 ? { OR: or } : {}),
  };
}

export function findAdminLeads(filter: LeadFilter, page: { limit: number; offset: number }) {
  return prisma.lead.findMany({
    where: toWhere(filter),
    // Yangi arizalar birinchi: menejer aynan ular bilan ishlaydi.
    orderBy: { createdAt: 'desc' },
    take: page.limit,
    skip: page.offset,
    include: { product: true },
  });
}

export function countAdminLeads(filter: LeadFilter): Promise<number> {
  return prisma.lead.count({ where: toWhere(filter) });
}

/** Bosh sahifadagi hisoblagichlar uchun. */
export async function countLeadsByStatus(): Promise<Record<LeadStatus, number>> {
  const rows = await prisma.lead.groupBy({ by: ['status'], _count: { _all: true } });

  const result: Record<LeadStatus, number> = { NEW: 0, IN_WORK: 0, DONE: 0, REJECTED: 0 };
  for (const row of rows) result[row.status] = row._count._all;

  return result;
}
