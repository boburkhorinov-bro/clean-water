import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { resolvePoolMax } from './db-pool';

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

  // Hovuz o'lchami bazadagi `max_connections` ga bog'liq va deployda
  // sozlanadi — tafsilotlar `db-pool.ts` da.
  const adapter = new PrismaPg({
    connectionString,
    max: resolvePoolMax(process.env.DATABASE_POOL_MAX),
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Modul darajasidagi kesh — barcha rejimlar uchun.
 *
 * Avval klient faqat dev da (global orqali) saqlanardi, prodda esa HAR
 * murojaatda yangidan qurilardi. Har bir klient o'z ulanishlar hovuzini
 * ochadi, ya'ni bir necha parallel so'rov PostgreSQL ning `max_connections`
 * limitini yeb qo'yardi va sahifalar 500 qaytarardi. Buni yuklama
 * tekshiruvi ochdi (§7).
 */
let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  // Dev da global kesh HMR uchun kerak: modul qayta yuklanganda modul
  // darajasidagi o'zgaruvchi yo'qoladi, `globalThis` esa qoladi.
  const existing = globalForPrisma.prisma ?? client;
  if (existing) return existing;

  client = createPrismaClient();
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
