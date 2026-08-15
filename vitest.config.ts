import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Sof birlik testlari. Bazaga tegadiganlari `*.int.test.ts` va
    // `vitest.int.config.ts` orqali alohida ishga tushiriladi — ular
    // ko'tarilgan PostgreSQL ni talab qiladi.
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'src/generated/**', '**/*.int.test.*'],
    // Standart `threads` puli bu muhitda V8 xotirasini tugatadi
    // (`NewSpace::EnsureCurrentCapacity Allocation failed`). `forks` barqaror.
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
