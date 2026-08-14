import { prisma } from '@/server/db';

/**
 * O'rnatishlar va o'rnatilgan kartrijlarga kirish (§4.2 — repositories qatlami).
 *
 * Yozish tranzaksiya ichida bo'lgani uchun `services/installations.ts` da
 * qoladi (`resolve-client.ts` dagi kabi) — bu yerda faqat o'qish.
 */

/** Mijoz kartochkasi va «Mening filtrim» ekrani uchun bir xil shakl. */
export const installationInclude = {
  filterProduct: true,
  parts: {
    orderBy: { dueAt: 'asc' },
    include: { cartridgeProduct: { include: { cartridgeSpec: true } } },
  },
} as const;

export function findInstallationById(id: string) {
  return prisma.installation.findUnique({ where: { id }, include: installationInclude });
}

export function findInstallationsByUser(userId: string) {
  return prisma.installation.findMany({
    where: { userId },
    orderBy: { installedAt: 'desc' },
    include: installationInclude,
  });
}

export function findInstalledPartById(id: string) {
  return prisma.installedPart.findUnique({
    where: { id },
    include: { cartridgeProduct: { include: { cartridgeSpec: true } } },
  });
}
