# Ralph Agent Configuration

Skelet yaratildi. Quyidagi buyruqlar ishlaydi va tekshirilgan.

## Build Instructions

```bash
npm install
npx prisma generate      # `src/generated/prisma/` ga yozadi
npm run build
```

## Test Instructions

```bash
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm test                 # birlik testlari — baza kerak emas
npm run test:int         # integratsiya testlari — HAQIQIY bazani talab qiladi
```

DIQQAT: bularni `&&` bilan zanjirlamang — xotira taqchilligi tufayli osilib
qoladi. Alohida-alohida ishga tushiring.

Integratsiya testlari `cleanwater_test` bazasida ishlaydi (ishlab chiqish
bazasiga tegmaydi — `src/test/int-setup.ts` buni majburlaydi). Birinchi marta:

```bash
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE cleanwater_test OWNER cleanwater;"
DATABASE_URL="postgresql://cleanwater:cleanwater@127.0.0.1:5432/cleanwater_test?schema=public" \
  npx prisma migrate deploy
```

## Run Instructions

```bash
cp env.example .env      # birinchi marta: qiymatlarni to'ldiring

# Lokal ishlab chiqish (baza ko'tarilgan bo'lishi kerak)
docker compose up -d postgres
npx prisma migrate deploy   # yoki migrate dev — yangi migratsiya kerak bo'lsa
npm run db:seed             # demo katalog
npm run dev                 # http://localhost:3000 → /uz ga redirect

# Worker alohida
npm run worker:dev

# To'liq stek
docker compose up --build
```

## Versiya cheklovlari (BUZMANG — sinab ko'rilgan)

npm dagi `latest` versiyalar bu stek bilan ishlamaydi. Quyidagilar ataylab pastroq:

- **TypeScript 6.0.3** — 7.x emas. `typescript-eslint` TS 7 API sini
  qo'llab-quvvatlamaydi (`typescript-eslint does not support TS 7.0`).
- **ESLint 9.39.5** — 10.x emas. `eslint-config-next` ichidagi
  `eslint-plugin-react` ESLint 10 da olib tashlangan `context.getFilename()` ni
  chaqiradi.

Bularni ko'tarishdan oldin `npm run lint` ni haqiqatan ishga tushirib ko'ring.

## Lokal baza: Docker SIZ (bu mashinada)

Docker Desktop bu mashinada ko'tarilmaydi (pastdagi «xotira» bo'limiga qarang),
shuning uchun lokal PostgreSQL **to'g'ridan-to'g'ri Windows da** ishlaydi.

**Muhim: bu Windows xizmati EMAS.** winget orqali o'rnatish yarim yo'lda uzilgan —
binarlar ko'chirilgan, lekin `initdb` ham, xizmat ham yaratilmagan. Data papkasi
qo'lda initsializatsiya qilingan, server qo'lda ishga tushiriladi. Ya'ni
**kompyuter qayta yuklangandan keyin uni qo'lda ko'tarish kerak.**

```bash
PGBIN="/c/Program Files/PostgreSQL/17/bin"
PGDATA="/c/Users/Lenovo/pgdata-cleanwater"

# Ishga tushirish (kamaytirilgan sozlamalar — xotira taqchil)
"$PGBIN/pg_ctl.exe" -D "$PGDATA" -l "$PGDATA/server.log" \
  -o "-c shared_buffers=32MB -c max_connections=10 -c listen_addresses=127.0.0.1 -c port=5432" \
  start > /dev/null 2>&1 </dev/null &

# Tayyorligini kutish
"$PGBIN/pg_isready.exe" -h 127.0.0.1 -p 5432

# To'xtatish
"$PGBIN/pg_ctl.exe" -D "$PGDATA" stop
```

DIQQAT: `pg_ctl` chiqishini `| tail` ga ulasangiz u osilib qoladi — faylga yoki
`/dev/null` ga yo'naltiring. Va serverni bash vazifasi ichida qoldirmang:
vazifa to'xtatilsa postgres ham o'ladi.

Ulanish satri (`env.example` dagi bilan bir xil):
`postgresql://cleanwater:cleanwater@127.0.0.1:5432/cleanwater?schema=public`

Parol `cleanwater` — faqat lokal ishlab chiqish uchun, 127.0.0.1 ga bog'langan.
Prodda `docker-compose.yml` dagi `postgres` xizmati ishlatiladi.

## `next build` dan keyin `next dev` — `.next` ni tozalang

`npm run build` dan keyin `npm run dev` ishga tushirilsa, **hamma marshrut 404
qaytaradi** (`/uz`, `/app`, `/admin` — hammasi). Sabab: `.next` ildizida
production artefaktlari (`BUILD_ID`, `standalone/`, `app-paths-manifest.json`)
qoladi va ular `next dev` ning `.next/dev` daryosi bilan aralashadi. Log da
xato ko'rinmaydi — sahifa oddiygina «topilmadi» bo'ladi, shuning uchun buni
o'z koding buzgan deb o'ylash oson.

Yechim — dev dan oldin keshni tozalash:

```bash
git clean -xfdq .next
```

## ⚠️ Muhit cheklovi: xotira

Bu mashinada **3.8 GB RAM, odatda ~0.3–0.5 GB bo'sh**. Eng katta iste'molchilar —
Claude Code (~930 MB) va VS Code (~400 MB). Oqibatlari:

- **Docker Desktop ko'tarilmaydi** — WSL2 backend bir necha GB talab qiladi.
- **PostgreSQL vaqti-vaqti bilan yiqiladi.** Log da
  `terminated by exception 0xC0000142` (DLL init failure) ko'rinsa — bu xotira
  yetishmasligi. Baza qayta ko'tarilganda crash-recovery dan o'tadi (~15 s).
- **`npm run build` beqaror** — TypeScript worker i yiqilishi mumkin
  (`Failed to type check`). Qayta ishga tushirilsa o'tadi.
- **Tekshiruvlarni zanjirlab ishga tushirmang.** `npm run lint && npm run typecheck
  && npm test` bitta buyruqda 10 daqiqada tugamaydi. Alohida-alohida ishga
  tushiring — har biri ~10 soniya.
- **Vitest `threads` puli ishlamaydi** — `vitest.config.ts` da `pool: 'forks'`.

## Prisma 7 xususiyatlari

- `datasource` blokida `url` YO'Q — olib tashlangan. Ulanish satri ikki joyda:
  migratsiyalar uchun `prisma.config.ts`, ilova uchun `PrismaPg` adapteri
  (`src/server/db.ts`).
- `package.json` dagi `prisma` kaliti ishlamaydi — barcha sozlama
  `prisma.config.ts` da.
- Klient `node_modules` ga emas, `src/generated/prisma/` ga generatsiya qilinadi
  va u `.gitignore` da. Import: `@/generated/prisma/client`.
- npm 11 install-skriptlarni bloklaydi. `package.json` dagi `allowScripts`
  bloki `prisma`, `@prisma/engines`, `esbuild`, `unrs-resolver` ga ruxsat beradi —
  ularsiz `prisma generate` ham, lint ham ishlamaydi.

## Notes

- Stek: Next.js 16 (App Router, TypeScript) + Prisma 7 + PostgreSQL 17, hammasi Docker da.
- Konteynerlar: `web` (Next.js :3000), `worker` (Telegram bot + kunlik rejalashtiruvchi),
  `postgres` (:5432), `nginx` (TLS, rate-limit, CSP, `/media` uzatish).
- Next.js 16 da `middleware.ts` emas, `src/proxy.ts` — konvensiya qayta nomlangan.
- Marshrut guruhlarining har birida o'z root layouti bor (`<html>` + `<body>`),
  ildizda `app/layout.tsx` YO'Q. `/` manzilini `proxy.ts` `/uz` ga yo'naltiradi.
- Muhit o'zgaruvchilari — `env.example` bo'yicha `.env` da; sirlar repozitoriyga tushmaydi.
  Asosiylari: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_IDS`, `JWT_SECRET`.
- Update this file when build process changes.
