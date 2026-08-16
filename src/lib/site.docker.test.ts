import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/**
 * `NEXT_PUBLIC_SITE_URL` build vaqtida beriladimi (§4.7).
 *
 * `site.ts` uni `process.env.NEXT_PUBLIC_SITE_URL` orqali to'g'ridan-to'g'ri
 * o'qiydi, Next.js esa `NEXT_PUBLIC_*` ni QURISH paytida kodga muhrlaydi.
 * Shuning uchun uni faqat `environment:` da berish YETARLI EMAS: obraz allaqachon
 * qurilib bo'lgan bo'ladi va ichida `http://localhost:3000` qolib ketadi.
 *
 * Buzilish jimgina bo'ladi — ilova ko'tariladi, sahifalar 200 qaytaradi, lekin
 * har bir canonical, hreflang, `robots.txt` va `sitemap.xml` localhost ga
 * ishora qiladi. Buni faqat qidiruv tizimi indeksni buzganda sezish mumkin.
 *
 * Test Docker ni ishga tushirmaydi — u ikki fayl o'rtasidagi kelishuvni
 * tekshiradi, xuddi `security-headers.nginx.test.ts` kabi.
 */

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8');
}

/**
 * Izoh qatorlarini olib tashlaydi.
 *
 * Bloklar kalit so'z bo'yicha kesiladi (`args:` dan `environment:` gacha), izohda
 * esa o'sha kalit so'z matn sifatida uchrashi mumkin — va kesish noto'g'ri joyda
 * to'xtaydi. Test konfiguratsiyaning MAZMUNINI tekshirishi kerak, izohlarini emas.
 */
function stripComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

/** `FROM ... AS <name>` dan keyingi bosqich tanasi. */
function stage(dockerfile: string, name: string): string {
  const start = dockerfile.search(new RegExp(`^FROM .* AS ${name}\\s*$`, 'm'));
  if (start === -1) throw new Error(`Dockerfile da "${name}" bosqichi yo'q`);

  const rest = dockerfile.slice(start + 1);
  const next = rest.search(/^FROM /m);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('Dockerfile — NEXT_PUBLIC_SITE_URL build vaqtida', () => {
  const dockerfile = stripComments(read('Dockerfile'));
  const builder = stage(dockerfile, 'builder');

  test('builder bosqichi ARG sifatida qabul qiladi', () => {
    expect(builder).toMatch(/^ARG NEXT_PUBLIC_SITE_URL/m);
  });

  test('ARG `npm run build` dan OLDIN ENV ga chiqariladi', () => {
    // ARG ning o'zi RUN uchun ko'rinmaydi — u ENV ga ko'chirilishi kerak.
    const envLine = builder.search(/^ENV NEXT_PUBLIC_SITE_URL=/m);
    const buildLine = builder.search(/npm run build/m);

    expect(envLine).toBeGreaterThan(-1);
    expect(buildLine).toBeGreaterThan(-1);
    expect(envLine).toBeLessThan(buildLine);
  });

  test('qiymat yo`q yoki https emas bo`lsa build yiqiladi', () => {
    // Aks holda xato prodgacha jimgina yetib boradi. Build vaqtida to'xtash —
    // yagona joy: ish vaqtida tekshiruv (instrumentation.ts) muhrlangan
    // qiymatni ko'rmaydi, u faqat `environment:` dagisini ko'radi.
    expect(builder).toMatch(/case "\$NEXT_PUBLIC_SITE_URL" in|https:\/\/\*\)/);
    expect(builder).toMatch(/exit 1/);
  });
});

describe('docker-compose.yml — build argumenti uzatiladi', () => {
  const compose = stripComments(read('docker-compose.yml'));

  test('web xizmati build.args da NEXT_PUBLIC_SITE_URL ni beradi', () => {
    const web = compose.slice(compose.indexOf('\n  web:'));
    const service = web.slice(0, web.indexOf('\n  worker:'));

    expect(service).toMatch(/args:/);
    expect(service).toMatch(/NEXT_PUBLIC_SITE_URL: \$\{NEXT_PUBLIC_SITE_URL\}/);
  });

  test('ish vaqtidagi environment ham saqlanadi', () => {
    // Ikkalasi ham kerak: build — muhrlash uchun, environment — env.ts
    // tekshiruvi va server tomonidagi dinamik o'qish uchun.
    const web = compose.slice(compose.indexOf('\n  web:'));
    const service = web.slice(0, web.indexOf('\n  worker:'));
    const args = service.slice(service.indexOf('args:'), service.indexOf('environment:'));
    const environment = service.slice(service.indexOf('environment:'));

    expect(args).toMatch(/NEXT_PUBLIC_SITE_URL/);
    expect(environment).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });
});
