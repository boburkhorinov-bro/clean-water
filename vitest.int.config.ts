import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Integratsiya testlari — HAQIQIY PostgreSQL ga qarshi.
 *
 * Prisma ni mocklash dublikat birlashtirish kabi mantiqni tekshirmaydi:
 * u butunlay baza holati va cheklovlari haqida. Shuning uchun bu testlar
 * alohida `cleanwater_test` bazasida ishlaydi.
 *
 * Talab: postgres ko'tarilgan bo'lishi kerak (`.ralph/AGENT.md` ga qarang)
 * va `cleanwater_test` bazasiga migratsiya qo'llangan bo'lishi kerak.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts', 'worker/**/*.int.test.ts', 'scripts/**/*.int.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'src/generated/**'],
    pool: 'forks',
    // Bitta baza — testlar bir-birining ma'lumotini o'chirib yubormasligi uchun
    // ketma-ket ishlaydi.
    fileParallelism: false,
    setupFiles: ['./src/test/int-setup.ts'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
