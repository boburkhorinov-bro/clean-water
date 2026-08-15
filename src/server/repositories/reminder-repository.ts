import { prisma } from '@/server/db';

/**
 * Eslatmalar uchun so'rovlar (§4.2 — repositories qatlami).
 */

/**
 * Bugungi o'tishda ko'rib chiqiladigan kartrijlar (§4.6, 1-qadam).
 *
 * `replaced_at IS NULL` — almashtirilgani jadvaldan chiqadi. `due_at <= horizon`
 * — 30 kunlik chegaradan narigilarini tortishning ma'nosi yo'q. Tartib
 * shoshilinchlik bo'yicha: 429 ga urilib qolsak, muddat kelganlar yuborilgan
 * bo'ladi, «30 kun qoldi» esa ertaga ham ketaveradi.
 *
 * Indeks: `@@index([replacedAt, dueAt])`.
 */
export function findPartsNeedingReminder(horizon: Date) {
  return prisma.installedPart.findMany({
    where: { replacedAt: null, dueAt: { lte: horizon } },
    orderBy: { dueAt: 'asc' },
    include: {
      cartridgeProduct: true,
      installation: {
        include: {
          filterProduct: true,
          user: true,
        },
      },
    },
  });
}
