import { prisma } from '@/server/db';

/**
 * Har bir testdan oldin bazani tozalaydi.
 *
 * `TRUNCATE ... CASCADE` ketma-ketlik va tashqi kalitlar bilan ovora
 * bo'lmaslik uchun. `_prisma_migrations` tegilmaydi — aks holda keyingi
 * `migrate deploy` sxemani qayta yaratmoqchi bo'ladi.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      notifications, installed_parts, installations,
      leads, compatibilities, cartridge_specs, products, audit_logs, users
    RESTART IDENTITY CASCADE
  `);
}
