import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'src/generated/**'],
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
