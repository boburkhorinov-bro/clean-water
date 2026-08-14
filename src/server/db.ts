import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Prisma 7: ulanish satri ilova kodida, driver adapter orqali beriladi.
 *
 * Klient DANGASA (lazy) quriladi — import paytida emas, birinchi murojaatda.
 * Sababi: `next build` page data yig'ish uchun har bir route modulini import
 * qiladi, lekin `DATABASE_URL` o'shanda mavjud emas (u ish vaqtidagi sir).
 * Ilgari bu «Failed to collect page data» bilan buildni yiqitardi.
 *
 * Next.js dev rejimida modullar qayta yuklanadi, shuning uchun klient
 * globalga saqlanadi — aks holda har hot-reload da yangi ulanish hovuzi
 * ochilib, PostgreSQL ulanish limitini yeb qo'yadi.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL o‘rnatilmagan. env.example dan .env yarating.');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function getClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property) as unknown;
    // `$connect` kabi metodlar klientga bog'lanadi; `user` kabi delegatlar
    // obyekt bo'lgani uchun o'z holicha qaytariladi.
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
