import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/**
 * Deploy zanjirining ichki kelishuvi (§4.1, §7).
 *
 * Bu yerda Docker ishga tushirilmaydi — u bu mashinada ko'tarilmaydi
 * (CLAUDE.md). Tekshirilayotgani uchta fayl o'rtasidagi kelishuv:
 * `Dockerfile`, `docker-compose.yml` va `scripts/deploy.sh` (hamda uni
 * takrorlaydigan `docs/DEPLOY.md`). Xuddi `security-headers.nginx.test.ts`
 * va `site.docker.test.ts` kabi.
 *
 * NIMA UCHUN KERAK. Deploy skripti serverda BIR MARTA, ishonch talab
 * qiladigan paytda ishlaydi va bu yerda uni sinab ko'rish imkoni yo'q.
 * Aynan shunday buzilish topildi: skript migratsiyalarni `web` konteyneri
 * ichida chaqirardi, `web` ning runtime bosqichida esa `.next/standalone`
 * dan boshqa hech narsa yo'q — na `prisma` CLI, na `prisma/migrations/`,
 * na `prisma.config.ts`. Deploy 4-qadamda yiqilardi.
 */

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

const compose = read('docker-compose.yml');
const dockerfile = read('Dockerfile');
const deployScript = read('scripts/deploy.sh');
const deployDoc = read('docs/DEPLOY.md');

describe('migratsiyalar qayerda ishlaydi', () => {
  /**
   * `web` obrazining runner bosqichi faqat `.next/standalone` ni oladi.
   * Bu ataylab: obraz kichik bo'lishi kerak. Lekin demak, u yerda Prisma
   * CLI ham, migratsiya fayllari ham yo'q.
   */
  test('`web` runner bosqichi prisma manbalarini ko‘chirmaydi', () => {
    const runner = dockerfile.slice(dockerfile.indexOf('AS runner'));

    expect(runner).not.toMatch(/COPY .*prisma/);
    expect(runner).not.toMatch(/COPY .*node_modules/);
  });

  test('deploy skripti migratsiyani `web` ichida chaqirmaydi', () => {
    expect(deployScript).not.toMatch(/exec[^\n]*\bweb\b[^\n]*prisma/);
  });

  test('hujjat ham `web` ichida chaqirmaydi — u qo‘lda takrorlanadi', () => {
    expect(deployDoc).not.toMatch(/exec[^\n]*\bweb\b[^\n]*prisma/);
    // `db:seed` ham o'sha obrazda: unga `tsx` va `prisma/seed.ts` kerak.
    expect(deployDoc).not.toMatch(/exec[^\n]*\bweb\b[^\n]*db:seed/);
  });

  test('Dockerfile da migratsiyalar uchun alohida bosqich bor', () => {
    // `builder` da to'liq `node_modules` (prisma CLI, tsx) va butun manba
    // daraxti — `prisma/migrations/` bilan birga — allaqachon bor.
    expect(dockerfile).toMatch(/FROM builder AS migrator/);
  });

  test('compose da bir martalik `migrate` xizmati bor', () => {
    expect(compose).toMatch(/^ {2}migrate:$/m);
    expect(compose).toMatch(/target: migrator/);
    // Qayta ishga tushirilmaydi: u tugab, o'chishi kerak.
    expect(compose).toMatch(/restart: 'no'/);
  });

  /**
   * Eng muhim bog'lanish: `web` migratsiyalar TUGAGUNCHA ko'tarilmaydi.
   * Aks holda ilova eski sxemadagi bazaga ulanib, so'rovlarni 500 bilan
   * qaytarardi — va buni faqat mijoz sezardi.
   */
  test('`web` migratsiyalar tugashini kutadi', () => {
    const webBlock = compose.slice(compose.indexOf('\n  web:'), compose.indexOf('\n  worker:'));

    expect(webBlock).toMatch(/migrate:\s*\n\s*condition: service_completed_successfully/);
  });

  test('`worker` ham kutadi — u ham bazaga boradi', () => {
    // Eslatmalar o'tishi eski sxemada yiqilardi, `restart: unless-stopped`
    // esa buni cheksiz tsiklga aylantirardi.
    const workerBlock = compose.slice(
      compose.indexOf('\n  worker:'),
      compose.indexOf('\n  # ── Zaxira'),
    );

    expect(workerBlock).toMatch(/migrate:\s*\n\s*condition: service_completed_successfully/);
  });
});

/**
 * `.env` dagi eng qimmat ikkita xato.
 *
 * Ikkalasi ham deploy ni oxirigacha olib boradi va faqat ilova bazaga
 * ulanmoqchi bo'lganda ko'rinadi — ya'ni obrazlar qurilib, sertifikat
 * olinganidan keyin. Skript ularni BOSHIDA aytadi.
 */
describe('`.env` qo‘riqchilari', () => {
  test('konteyner ichidagi `localhost` ushlanadi', () => {
    // `env.example` da namuna qiymat aynan `localhost` — u lokal ishlab
    // chiqish uchun. Konteyner ichida `localhost` konteynerning o'zi
    // bo'ladi va ulanish rad etiladi.
    expect(deployScript).toMatch(/DATABASE_URL/);
    expect(deployScript).toMatch(/localhost/);
    expect(deployScript).toMatch(/127\.0\.0\.1/);
  });

  test('parol ikki joyda mos kelishi tekshiriladi', () => {
    // `POSTGRES_PASSWORD` bazani YARATADI, `DATABASE_URL` unga ULANADI.
    // Ular ajralib qolsa, xato «password authentication failed» bo'lib
    // `web` loglarida qoladi va sababi darhol ko'rinmaydi.
    expect(deployScript).toMatch(/POSTGRES_PASSWORD/);
  });
});

/**
 * Compose loyiha nomi volume nomlarining old qo'shimchasi bo'ladi. U
 * ko'rsatilmasa, papka nomidan olinadi — ya'ni repozitoriy qaysi papkaga
 * klonlangani volume nomini o'zgartirardi.
 *
 * Bu jimgina buziladi: `deploy.sh` sertifikat olayotganda
 * `cleanwater_certbot-webroot` ni ulaydi. Nom mos kelmasa, Docker YANGI
 * BO'SH volume yaratadi, nginx esa boshqasidan o'qiydi — Let's Encrypt
 * tekshiruvi 404 oladi va sertifikat berilmaydi. Xato esa «challenge
 * failed» bo'lib ko'rinadi, sababi ko'rinmaydi.
 */
describe('compose loyiha nomi', () => {
  test('nom aniq belgilangan', () => {
    expect(compose).toMatch(/^name: cleanwater$/m);
  });

  test('deploy skriptidagi volume nomi shunga mos', () => {
    const volumes = deployScript.match(/\b[a-z0-9]+_[a-z0-9-]+:\/[^\s\\]+/g) ?? [];
    expect(volumes.length).toBeGreaterThan(0);

    for (const mount of volumes) {
      expect(mount).toMatch(/^cleanwater_/);
    }
  });
});
