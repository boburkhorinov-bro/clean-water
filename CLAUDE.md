# CLAUDE.md — Clean Water

Osmos filtrlar va kartrijlar sotuvi platformasi. Telegram Mini App + SEO uchun
SSR li ommaviy sayt, bitta kod bazasida. To'lov yo'q: buyurtma = ariza,
menejerga Telegramda xabar boradi.

**To'liq TZ:** [spec.md](spec.md) (ruscha, asosiy) va [spec.uz.md](spec.uz.md)
(o'zbekcha tarjima). Ikkalasi parallel yuritiladi.
**Ish rejasi va holat:** [.ralph/fix_plan.md](.ralph/fix_plan.md) — progressni
shu yerdan va `git log` dan tekshiring, `.ralph/status.json` dan EMAS.
**Build/run tafsilotlari:** [.ralph/AGENT.md](.ralph/AGENT.md).

## Ishni boshlashdan oldin: bazani ko'taring

PostgreSQL Docker siz, **Windows xizmati sifatida emas** ishlaydi. Kompyuter
qayta yuklangandan keyin har safar qo'lda ko'tarish kerak:

```bash
PGBIN="/c/Program Files/PostgreSQL/17/bin"
PGDATA="/c/Users/Lenovo/pgdata-cleanwater"
"$PGBIN/pg_ctl.exe" -D "$PGDATA" -l "$PGDATA/server.log" \
  -o "-c shared_buffers=32MB -c max_connections=10 -c listen_addresses=127.0.0.1 -c port=5432" \
  start > /dev/null 2>&1 </dev/null &
"$PGBIN/pg_isready.exe" -h 127.0.0.1 -p 5432   # tayyorligini kutish (~15 s)
```

- `pg_ctl` chiqishini `| tail` ga **ulamang** — osilib qoladi.
- Serverni bash vazifasi ichida qoldirmang: vazifa to'xtatilsa postgres ham o'ladi.
- `DATABASE_URL="postgresql://cleanwater:cleanwater@127.0.0.1:5432/cleanwater?schema=public"`
  — `localhost` **emas**: Windows da u avval `::1` ga hal bo'ladi, postgres esa
  faqat `127.0.0.1` ni tinglaydi.
- `.env` bor — `env.example` dan yasalgan, o'zgaruvchini qo'lda berish shart emas.
  Ruxsat sozlamalari uni **o'qishni** taqiqlaydi (`Read(.env)`), yozishni emas.
  Telegram qiymatlari bo'sh (bot tokeni, admin ID lar, menejerlar guruhi) —
  ular loyiha egasida.

## Muhit cheklovi: 3.8 GB RAM

Bu mashinada odatda ~0.3 GB bo'sh. Oqibatlari va ular bilan ishlash:

- **Tekshiruvlarni `&&` bilan zanjirlamang.** `npm run lint && npm run typecheck
  && npm test` osilib qoladi. Alohida ishga tushiring — har biri ~10 soniya.
- **Docker Desktop ko'tarilmaydi.** `docker compose up` hech qachon sinalmagan.
- **`npm run build` beqaror** — TypeScript worker i yiqilishi mumkin. Qayta urining.
- **PostgreSQL yiqilishi mumkin**: log da `0xC0000142` — bu xotira yetishmasligi.
  Qayta ko'tarilganda crash-recovery dan o'tadi.

## Versiya cheklovlari — KO'TARMANG

`latest` versiyalar bu stek bilan ishlamaydi (sinab ko'rilgan):

- **TypeScript 6.0.3**, 7.x emas — `typescript-eslint` TS 7 API sini qo'llamaydi.
- **ESLint 9.39.5**, 10.x emas — `eslint-config-next` ichidagi `eslint-plugin-react`
  ESLint 10 da olib tashlangan `context.getFilename()` ni chaqiradi.
- **Vitest `pool: 'forks'`** — `threads` bu muhitda V8 xotirasini tugatadi.

## Prisma 7 xususiyatlari

- `datasource` blokida `url` **yo'q** — Prisma 7 da olib tashlangan. Migratsiyalar
  uchun `prisma.config.ts`, ilova uchun `PrismaPg` adapteri (`src/server/db.ts`).
- `package.json` dagi `prisma` kaliti ishlamaydi — hammasi `prisma.config.ts` da.
- Klient `src/generated/prisma/` ga chiqadi (`.gitignore` da). Import: `@/generated/prisma/client`.
- `src/server/db.ts` klientni **dangasa** quradi. Buni buzmang: `next build` route
  modullarini `DATABASE_URL` siz import qiladi va eager qurish buildni yiqitadi.
- npm 11 install-skriptlarni bloklaydi. `package.json` dagi `allowScripts` bloki
  `prisma`, `@prisma/engines`, `esbuild`, `unrs-resolver` ga ruxsat beradi —
  usiz `prisma generate` ham, lint ham ishlamaydi. Bu blokni o'chirmang.

## Buyruqlar

```bash
npm run dev          # http://localhost:3000 → /uz ga redirect
npm run dev:login    # lokal admin sessiyasi — `/admin` va Mini App uchun
npm run build
npm run lint
npm run typecheck
npm test             # birlik testlari, baza kerak emas
npm run test:int     # integratsiya testlari, HAQIQIY bazani talab qiladi
npm run db:seed
npm run worker:dev   # Telegram bot + eslatmalar rejalashtiruvchisi, alohida jarayon
npx prisma migrate deploy
```

Klondan keyin birinchi marta: `npm install` → `npx prisma generate` →
`npx prisma migrate deploy` → `npm run db:seed`.

`/admin` va Mini App ning shaxsiy ekranlari Telegram `initData` sini talab
qiladi, lokal mashinada esa Telegram klienti yo'q — sessiyasiz ular 404
qaytaradi. `npm run dev:login` `.env` dagi bot tokeni bilan o'sha imzoni yasaydi
va brauzer konsoliga qo'yiladigan snippet beradi (cookie `httpOnly`, shuning
uchun uni JS bilan yozib bo'lmaydi — `fetch` javobidagi `Set-Cookie` ni brauzer
o'zi saqlaydi). Sessiya 24 soat yashaydi. Skript lokal bo'lmagan manzilni rad
etadi: u amaldagi ADMIN kalitini yasaydi.

Integratsiya testlari alohida `cleanwater_test` bazasida ishlaydi va
`src/test/int-setup.ts` buni majburlaydi — ular ishlab chiqish bazasiga tegmaydi.
Bu bazani birinchi marta qo'lda yaratish kerak — `.ralph/AGENT.md`, «Test Instructions».

## Deploy — uchta yo'l, biri tanlangan

- **Tanlangan (2026-08-20): Vercel + Render + Neon** — [docs/DEPLOY-PAAS.md](docs/DEPLOY-PAAS.md).
  Sayt Vercel da (`vercel.json`), `worker` Render da (`render.yaml`), baza Neon da.
  Render bepul rejasi 15 daqiqadan keyin uxlaydi — shuning uchun eslatmalarni
  jarayon ichidagi taymer emas, **tashqi cron** qo'zg'atadi (`/jobs/reminders`).
- **Docker/VPS** — [docs/DEPLOY.md](docs/DEPLOY.md), majburiy tekshiruv ro'yxati
  [DEPLOY.md](DEPLOY.md); `scripts/deploy.sh` o'sha qadamlarni idempotent bajaradi.
- **Oracle + DuckDNS (bepul)** — [docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md), tanlanmadi.

Loyiha egasidan kutilayotgani: [docs/TODO-OWNER.md](docs/TODO-OWNER.md).

## Arxitektura qoidalari — buzilmaydi (TZ §4)

Kod xaritasi:

```
src/app/(web)/[locale]/   ommaviy SSR sayt (uz/ru)
src/app/(miniapp)/app/    Telegram Mini App
src/app/(admin)/admin/    admin panel
src/app/api/              route handler lar — validatsiya + service chaqiruvi, mantiq yo'q
src/server/services/      biznes-mantiq  ·  src/server/repositories/  Prisma kirish
src/server/auth/          sessiya, requireAdmin, Telegram initData
src/server/telegram/      Bot API klienti, menejerga xabar
src/lib/i18n/             lokalizatsiya, buildAlternates
worker/bot/               Telegram webhook  ·  worker/jobs/  eslatmalar rejalashtiruvchisi
scripts/                  deploy, zaxira, tiklash, yuklama testi
```

- Biznes-mantiq `src/server/services/` da, ma'lumotlarga kirish
  `src/server/repositories/` da. React komponentlarida ham, route handler larda
  ham mantiq yo'q: u uchta joydan (web, Mini App, worker) chaqiriladi va bir xil
  ishlashi kerak.
- `dangerouslySetInnerHTML` **hech qayerda** ishlatilmaydi. Kontent — jsonb dagi
  tiplashtirilgan bloklar, `type` → React komponenti solishtiruvi bilan
  renderlanadi. Sxema `src/lib/content-blocks.ts` da va u rasm manzilini
  `/media/` bilan, video id ni harf-raqam bilan cheklaydi.
- Rollar serverda tekshiriladi (`requireAdmin()` / `getSession()`), har so'rovda.
  Klientdagi admin tumbleri hech qanday huquq bermaydi.
- Barcha MB so'rovlari Prisma orqali, barcha kirish zod bilan validatsiya qilinadi.
- Eslatmalar rejalashtiruvchisi **faqat** `worker` konteynerida, hech qachon
  Next.js ichida — aks holda ikkinchi instansda dublikatlanadi va har deployda o'ladi.
- Eslatmalar idempotentligi kodda emas, **bazada**: `notifications` dagi
  `(installed_part_id, kind)` unique indeksi.
- Ariza **avval bazaga** yoziladi, javob mijozga **shundan keyin** qaytariladi,
  Telegram xabarnomasi esa eng oxirida va uning nosozligi javobga ta'sir qilmaydi.
- Yetishmayotgan tarjima bo'shliq ko'rsatmaydi, o'zbekchaga tushadi.
- Progress-shkalalar faqat real ma'lumot ko'rsatadi. Dekorativ shkala yo'q.
- Amalga oshirilmagan bo'limlar menyuda ko'rsatilmaydi — «tez orada» yo'q.

## Next.js 16 nozikliklari

- `middleware.ts` emas, **`src/proxy.ts`** — konvensiya qayta nomlangan.
- **`npm run build` dan keyin `npm run dev` — avval `git clean -xfdq .next`.**
  Aks holda hamma marshrut jimgina 404 qaytaradi: `.next` ildizidagi production
  artefaktlari `next dev` bilan aralashadi. Log da xato yo'q — buni o'z koding
  buzgan deb o'ylash oson.
  **Tozalash yetarli bo'lmasa, avval jarayonni o'ldiring.** `next dev` ni
  to'xtatganda `node` 3000-portda qolib ketadi va `git clean` turbopack keshini
  o'chira olmaydi (`Invalid argument` — fayllar band). O'sha keshdan ko'tarilgan
  server marshrut daraxtini chala quradi va yana hamma joyda 404 beradi
  (`/api/health` ham). Tartib: `netstat -ano | grep :3000` →
  `taskkill //F //PID <pid> //T` → `git clean -xfdq .next` → `npm run dev`.
- **`.next/dev/types/routes.d.ts` `npm run typecheck` ni yiqitishi mumkin**
  (`TS1434`, `TS1128`): ishlab turgan dev-server uni qayta yozayotganda tsc
  yarim yozilgan faylni o'qiydi. Bu kod xatosi emas —
  `git clean -xfdq .next/dev/types` va qayta tekshiring.
- Marshrut guruhlarining har birida o'z root layouti bor (`<html>` + `<body>`),
  ildizda `app/layout.tsx` **yo'q**. `/` ni `proxy.ts` `/uz` ga yo'naltiradi.
- Har bir yangi ommaviy sahifa o'z `generateMetadata` ida `buildAlternates` ni
  (`src/lib/i18n/alternates.ts`) chaqirishi shart — layout pathname ni bilmaydi,
  canonical/hreflang shundan quriladi.
- Katalog sahifalarida ISR uchun `export const revalidate = 60` **va**
  `generateStaticParams` — ikkalasi ham. Yolg'iz `revalidate` bilan Next.js
  dinamik marshrutni umuman keshlamaydi: hech narsa yiqilmaydi, sayt sekinlashadi
  (11.5 RPS ga qarshi 40.9). `catalog-revalidate.test.ts` shuni qo'riqlaydi.

## Tegilmaydigan fayllar

- `.ralph/` va `.ralphrc` — Ralph ning boshqaruv fayllari.
- `spec.md`, `prompt.md` — buyurtmachining asl hujjatlari.
- `ralph-claude-code/` — Ralph asbobining tashqi checkout i, `.gitignore` da.
  Loyiha kodi emas; ichidagi `CLAUDE.md` bu loyihaga taalluqli emas.

## Ish uslubi

- Yangi funksiya yoki tuzatish — **avval test, keyin kod** (TDD). Testning
  yiqilishini ko'rmasdan implementatsiya yozilmaydi.
- Bazaga tegadigan mantiq uchun Prisma mocklanmaydi — `*.int.test.ts` yoziladi.
  Mock dublikat birlashtirish kabi narsani umuman isbotlamaydi.
- Tugallangan deb aytishdan oldin buyruq chiqishi bilan tasdiqlanadi.
- Muloqot o'zbek tilida.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
