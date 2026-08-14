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
npm test                 # vitest (hozircha testlar yo'q)
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

## ⚠️ Muhit cheklovi: xotira

Bu mashinada **3.8 GB RAM, bo'sh — 0.3 GB**. Oqibatlari:

- **Docker Desktop ko'tarilmaydi.** ~20 daqiqada ham ishga tushmadi. WSL2 backend
  bir necha GB talab qiladi. Ya'ni `docker compose up`, `prisma migrate deploy`
  va `npm run db:seed` bu mashinada bajarilmagan va bajarib bo'lmaydi.
- **`npm run build` beqaror** — TypeScript worker i vaqti-vaqti bilan V8 xotira
  yetishmasligidan yiqiladi (`Failed to type check`). Qayta ishga tushirilsa o'tadi.
- **Vitest `threads` puli ishlamaydi** — shuning uchun `vitest.config.ts` da
  `pool: 'forks'` qadab qo'yilgan.

Build yiqilsa: boshqa dasturlarni yoping va qayta urinib ko'ring. Uzoq muddatli
yechim — baza va build ni boshqa mashinada (yoki to'g'ridan-to'g'ri VPS da) yuritish.

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
