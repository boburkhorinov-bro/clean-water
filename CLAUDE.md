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
- `.env` yo'q (ruxsat sozlamalari yozishni taqiqlaydi) — o'zgaruvchini qo'lda bering.

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

## Buyruqlar

```bash
npm run dev          # http://localhost:3000 → /uz ga redirect
npm run build
npm run lint
npm run typecheck
npm test             # birlik testlari, baza kerak emas
npm run test:int     # integratsiya testlari, HAQIQIY bazani talab qiladi
npm run db:seed
npx prisma migrate deploy
```

Integratsiya testlari `cleanwater_test` bazasida ishlaydi va
`src/test/int-setup.ts` buni majburlaydi — ular ishlab chiqish bazasiga tegmaydi.

## Arxitektura qoidalari — buzilmaydi (TZ §4)

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
- Marshrut guruhlarining har birida o'z root layouti bor (`<html>` + `<body>`),
  ildizda `app/layout.tsx` **yo'q**. `/` ni `proxy.ts` `/uz` ga yo'naltiradi.
- Har bir yangi ommaviy sahifa o'z `generateMetadata` ida `buildAlternates` ni
  chaqirishi shart — layout pathname ni bilmaydi, canonical/hreflang shundan quriladi.

## Tegilmaydigan fayllar

- `.ralph/` va `.ralphrc` — Ralph ning boshqaruv fayllari.
- `spec.md`, `prompt.md` — buyurtmachining asl hujjatlari.

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
