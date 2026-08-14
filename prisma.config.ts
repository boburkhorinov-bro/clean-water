import { defineConfig, env } from 'prisma/config';

// Prisma 7 `.env` ni o'zi yuklamaydi. Node 20.6+ built-in loaderi ishlatiladi,
// shuning uchun qo'shimcha `dotenv` bog'liqligi kerak emas.
try {
  process.loadEnvFile('.env');
} catch {
  // `.env` yo'q (masalan, CI yoki Docker) — o'zgaruvchilar muhitdan keladi.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
