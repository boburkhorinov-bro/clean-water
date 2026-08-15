import type { LeadStatus } from '@/generated/prisma/client';
import { prisma } from '@/server/db';
import { countLeadsByStatus } from '@/server/repositories/lead-repository';

/**
 * Admin panel bosh sahifasidagi ko'rsatkichlar (§7 dagi 5-band).
 *
 * §3 qoidasi bu yerda ham amal qiladi: faqat real ma'lumot. Hech qanday
 * «taxminiy o'sish» yoki to'ldiruvchi grafik yo'q — menejerga bugun nima
 * qilish kerakligini aytadigan sonlar.
 */

export interface AdminOverview {
  leads: Record<LeadStatus, number>;
  products: { filters: number; cartridges: number; archived: number };
  clients: number;
  installations: number;
  /** Muddati kelgan yoki o'tgan, hali almashtirilmagan kartrijlar. */
  dueParts: number;
}

export async function getAdminOverview(now: Date = new Date()): Promise<AdminOverview> {
  const [leads, filters, cartridges, archived, clients, installations, dueParts] =
    await Promise.all([
      countLeadsByStatus(),
      prisma.product.count({ where: { kind: 'FILTER', isActive: true } }),
      prisma.product.count({ where: { kind: 'CARTRIDGE', isActive: true } }),
      prisma.product.count({ where: { isActive: false } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.installation.count(),
      prisma.installedPart.count({ where: { replacedAt: null, dueAt: { lte: now } } }),
    ]);

  return {
    leads,
    products: { filters, cartridges, archived },
    clients,
    installations,
    dueParts,
  };
}
