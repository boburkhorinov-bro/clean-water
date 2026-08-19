import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/**
 * `render.yaml` — `worker` xizmatining Render dagi tavsifi.
 *
 * Docker da worker ning muhiti `docker-compose.yml` da edi va u shu
 * repozitoriyda tekshirilardi. Render da o'sha rol shu faylda; u yerda
 * xato qilinsa, xizmat ko'tariladi-yu, jimgina noto'g'ri ishlaydi.
 *
 * Bu yerda Render chaqirilmaydi — tekshirilayotgani fayllar o'rtasidagi
 * kelishuv, xuddi `deploy.test.ts` kabi.
 */

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

const render = read('render.yaml');
const vercel = JSON.parse(read('vercel.json')) as { buildCommand?: string };
const gitignore = read('.gitignore');
const workerIndex = read('worker/index.ts');
const envSource = read('src/server/env.ts');
const packageJson = JSON.parse(read('package.json')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('render.yaml', () => {
  /**
   * Eng jimgina tuzoq. Render `NODE_ENV=production` beradi, `npm ci` esa
   * bunday muhitda devDependencies ni O'RNATMAYDI. `tsx` va `prisma` aynan
   * o'sha ro'yxatda, ya'ni ishga tushirish buyrug'i (`npx tsx`) paketni
   * tarmoqdan qidirib qolardi.
   */
  test('build devDependencies ni ham o‘rnatadi', () => {
    expect(packageJson.devDependencies).toHaveProperty('tsx');
    expect(packageJson.devDependencies).toHaveProperty('prisma');
    expect(render).toMatch(/npm ci --include=dev/);
  });

  test('prisma klienti build paytida generatsiya qilinadi', () => {
    // Klient `.gitignore` da — repozitoriydan kelmaydi.
    expect(render).toMatch(/prisma generate/);
  });

  test('ishga tushirish buyrug‘i worker ni chaqiradi', () => {
    expect(render).toMatch(/startCommand:.*worker\/index\.ts/);
  });

  test('healthCheckPath worker haqiqatan javob beradigan manzil', () => {
    const path = /healthCheckPath:\s*(\S+)/.exec(render)?.[1];

    expect(path).toBe('/health');
    expect(workerIndex).toContain("request.url === '/health'");
  });

  /**
   * `env.ts` prodda yetishmayotgan o'zgaruvchida ilovani ATAYLAB
   * ko'tarilishga qo'ymaydi. Ya'ni bu ro'yxatdagi bitta nom `render.yaml`
   * ga tushmay qolsa, xizmat har deployda darhol yiqiladi.
   */
  test('worker uchun majburiy env lar tavsifda bor', () => {
    const block = /worker: \[([^\]]*)\]/.exec(envSource)?.[1];
    expect(block, 'env.ts dagi worker ro‘yxati topilmadi').toBeDefined();

    const required = [...block!.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]!);
    expect(required.length).toBeGreaterThan(0);

    for (const key of [...required, 'DATABASE_URL']) {
      expect(render, `render.yaml da ${key} yo‘q`).toMatch(new RegExp(`key: ${key}\\b`));
    }
  });

  /**
   * Sirlar repozitoriyga tushmaydi (§6). Render da buni `sync: false`
   * bildiradi: qiymat panelda qo'lda kiritiladi.
   */
  test('sirlar faylda ochiq yozilmagan', () => {
    for (const key of [
      'DATABASE_URL',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
      'CRON_SECRET',
    ]) {
      const entry = new RegExp(`key: ${key}\\s*\\n\\s*(sync: false|value:)`);
      const match = entry.exec(render);
      expect(match?.[1], `${key} qiymati faylda ochiq`).toBe('sync: false');
    }
  });
});

/**
 * Vercel — sayt. Bu yerda ham Render dagi bilan bir xil tuzoq bor, faqat
 * boshqa shaklda.
 */
describe('vercel.json', () => {
  /**
   * Prisma klienti `src/generated/prisma/` ga chiqadi va u `.gitignore` da —
   * ya'ni repozitoriydan KELMAYDI. Vercel standart holatda faqat
   * `next build` ni chaqiradi, `prisma generate` ni emas, va build
   * `@/generated/prisma/client` ni topa olmasdan yiqiladi.
   */
  test('build prisma klientini generatsiya qiladi', () => {
    expect(gitignore).toMatch(/src\/generated/);
    expect(vercel.buildCommand).toMatch(/prisma generate/);
    expect(vercel.buildCommand).toMatch(/next build/);
  });

  test('generatsiya build dan OLDIN bo‘ladi', () => {
    const command = vercel.buildCommand ?? '';
    expect(command.indexOf('prisma generate')).toBeLessThan(command.indexOf('next build'));
  });
});
