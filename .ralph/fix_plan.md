# Ralph Fix Plan — Clean Water

Manba: `.ralph/specs/requirements.md` (§8 «Критический путь»).
Tartib muhim: yuqoridagi punkt tugamaguncha pastdagisiga o'tilmaydi.
Har bir loopda **bitta** punkt bajariladi va shu yerda `- [x]` bilan belgilanadi.

## High Priority

### Skelet (kritik yo'l 3)
- [x] Next.js (App Router, TypeScript) skeletini yaratish: `src/app`, `src/server`, `src/components`, `src/lib`, `worker/`, `prisma/` — §4.9 dagi tuzilma bo'yicha. ESLint + Prettier + tsconfig strict.
- [x] `docker-compose.yml`: `web`, `worker`, `postgres`, `nginx` xizmatlari + `env.example` (§4.1). **`docker compose up` hamon sinab ko'rilmagan** — Docker Desktop bu mashinada ko'tarilmaydi. Lokal baza Docker siz ishlaydi, `.ralph/AGENT.md` ga qarang.
- [x] Prisma schema: `User`, `Product`, `CartridgeSpec`, `Compatibility`, `Lead`, `Installation`, `InstalledPart`, `Notification`, `AuditLog` (§5). Birinchi migratsiya + seed skripti.
      **HAQIQIY BAZADA TASDIQLANDI** (PostgreSQL 17.11, Docker siz): `migrate deploy`
      qo'llandi, 9 jadval + 7 enum yaratildi, `db:seed` 1 filtr va 3 kartrijni yozdi
      (6/24/12 oy resurs), ilovaning o'z klienti (`src/server/db.ts`) o'qib oldi.
- [x] `(installed_part_id, kind)` bo'yicha unique indeks — takroriy eslatmalarni BD darajasida bloklash (§4.6).
      **HAQIQIY BAZADA TASDIQLANDI**: bir xil `(installed_part_id, kind)` juftini ikkinchi
      marta qo'shishga urinish `duplicate key value violates unique constraint
      "notifications_installed_part_id_kind_key"` bilan rad etildi; ayni kartrij uchun
      DAYS_30 / DAYS_7 / DUE — uchalasi ham qabul qilindi.
- [x] Marshrut guruhlari: `(web)/[locale]`, `(miniapp)/app`, `(admin)/admin`, `api/` — bo'sh layoutlar bilan (§4.3). Har birida o'z root layouti; `/` → `/uz` redirect `src/proxy.ts` da.
- [x] i18n uz/ru: URL da til (`/uz`, `/ru`), `hreflang` + canonical, tarjima yo'q bo'lsa uz ga fallback (§4.7).
      `src/lib/i18n/localized.ts` (fallback, 6 test), `src/lib/i18n/alternates.ts` (hreflang, 6 test).
      Qurilgan HTML da tasdiqlangan. **Har bir YANGI sahifa o'z `generateMetadata` ida
      `buildAlternates` ni chaqirishi shart** — layout pathname ni bilmaydi.
- [x] Telegram avtorizatsiya: `POST /api/auth/telegram` — `initData` HMAC tekshiruvi, `auth_date` < 24h, `User` upsert, JWT httpOnly+Secure+SameSite cookie (§4.4).
      `telegram-init-data.ts` (12 test), `session.ts` (10 test), `user-repository.ts`,
      `api/auth/telegram/route.ts`.
      **Cookie: prodda `SameSite=None; Secure` SHART** — Mini App Telegram iframe i ichida,
      ya'ni uchinchi tomon konteksti; `Lax` da cookie umuman yuborilmaydi. Dev da `Lax`,
      chunki `None` brauzerdan `Secure` talab qiladi, lokal HTTP da esa u yo'q.
      **TEKSHIRILMAGAN: bazaga tegadigan yo'l** (`upsertTelegramUser` va route handler
      to'liq oqimi) — baza ko'tarilmagan.
- [~] ~~Telegram Login Widget bilan brauzerdan kirish~~ — **MVP dan CHIQARILDI**
      (loyiha egasining qarori, 2026-08-14). MVP da saytda kirish tugmasi umuman bo'lmaydi:
      katalog hammaga ochiq, ariza telefon raqami bilan qoldiriladi (§4.4 dagi «Mehmon»
      rejimi), shaxsiy kabinet faqat Mini App da.
      Sabab: Telegram sayt loginini OpenID Connect ga ko'chirgan
      (`https://oauth.telegram.org/.well-known/jwks.json` — RS256/ES256/EdDSA/ES256K),
      eski hash-usul arxivda. TZ §4.4 dagi «o'sha imzo tekshiruvi» ishlamaydi —
      JWKS bo'yicha JWT tekshiruvi (`iss`, `aud=<bot_id>`, `exp`) va `jose` kerak bo'lardi.
      **DIQQAT: ildizdagi `spec.md` §4.4 hali eski holatda — u bu qarorni aks ettirmaydi.**
- [x] `requireAdmin()` server-side guard + `TELEGRAM_ADMIN_IDS` env orqali bootstrap adminlar (§4.4).
      `admin-allowlist.ts` (12 test), `resolve-role.ts` (6 test), `require-admin.ts`.
      Qoida: **env faqat KO'TARADI** — admin panel orqali berilgan ADMIN har kirishda
      CLIENT ga tushib qolmaydi. Bo'sh env = hech kim admin emas.
      Telegram ID lar `bigint` — 2^53 dan katta ID `number` da yaxlitlanib boshqa
      odamning ID siga aylanib qolardi.
      Guard `(admin)/admin/layout.tsx` ga ulangan: admin bo'lmasa `notFound()` (403 emas,
      404 — panel mavjudligini bildirmaslik uchun). Build da tasdiqlangan: `/admin` endi
      `ƒ` (har so'rovda serverda), avval `○` (statik) edi.

### Katalog va zayavka (kritik yo'l 4)
- [ ] `services/` + `repositories/` qatlamlari: biznes-logika React komponentlarida ham, route handler larda ham yozilmaydi (§4.2).
- [ ] Kontent-bloklar renderi: `heading|paragraph|image|specs|video` tiplari React komponentlariga map qilinadi. `dangerouslySetInnerHTML` hech qayerda ishlatilmaydi (§4.8).
- [ ] Filtrlar katalogi: ro'yxat + mahsulot kartochkasi (foto, xarakteristika, narx, Kinescope video, tavsif bloklari). Komponentlar web va Mini App uchun umumiy.
- [ ] Kartrijlar katalogi: moslik (`Compatibility`) va resurs (`resource_months`) ko'rsatilgan holda.
- [ ] `POST /api/leads`: zod validatsiya, IP va Telegram ID bo'yicha rate-limit, telefonni `+998XXXXXXXXX` ga normalizatsiya, dublikat mijozni yopishtirish, `Lead(status=new)` yozish — javob shu yerda qaytariladi (§4.5).
- [ ] Menejerlar guruhiga asinxron Telegram xabarnoma + «Взять в работу» inline tugmasi, xatoda qayta urinish. Telegram ishlamasa ham zayavka yo'qolmaydi (§4.5).

### Admin panel (kritik yo'l 5)
- [ ] Adminka: mahsulotlar CRUD (filtrlar va kartrijlar, ikki tilda).
- [ ] Kontent-bloklar vizual muharriri (ixtiyoriy HTML qabul qilinmaydi; saqlashda sanitizatsiya).
- [ ] Zayavkalar bilan ishlash: `new → in_work → done | rejected` statuslari.
- [ ] `AuditLog` — har bir admin harakati yoziladi (§7).

### CRM (kritik yo'l 6)
- [ ] Mijozlar bazasi, telefon bo'yicha dublikatlarni yopishtirish (bitta mijozda bir nechta `Installation` bo'lishi mumkin).
- [ ] O'rnatishlarni qayd qilish: `Installation` + `InstalledPart`, `due_at` = `installed_at` + shu kartrijning `resource_months` (zayavka sanasidan emas).
- [ ] Kartrij almashtirilganini belgilash (`replaced_at`) va keyingi `due_at` ni hisoblash.

### Eslatmalar va «Mening filtrim» (kritik yo'l 7)
- [ ] Worker: har kuni 09:00 (Toshkent) — `due_at` gacha 30/7/0 kun qolgan `InstalledPart` larni tanlaydi, idempotentlik unique indeks bilan, `429` da `retry_after` ga rioya qiladi (§4.6).
- [ ] Telegram bot: `worker` konteynerida webhook, «Заказать замену» tugmasi darhol zayavka yaratadi.
- [ ] «Mening filtrim» ekrani: o'rnatilgan apparat, kartrijlar, real ma'lumotdan hisoblangan resurs shkalasi, almashtirishga buyurtma tugmasi.

### UI va dizayn (kritik yo'l 8)
- [ ] Dizayn-tokenlar: Montserrat, och ko'k + binafsha palitra, yorug'/qorong'i tema (Mini App da tema Telegram dan olinadi, qo'lda almashtiriladi).
- [ ] Dashboard: banner «CLEAN WATER ga xush kelibsiz» + katalogga o'tish. Dekorativ progress-shkala yo'q — faqat real ma'lumot.
- [ ] Responsive tekshiruv + PWA manifest.

### Ishga tushirishdan oldin (kritik yo'l 9)
- [ ] Xavfsizlik: CSP sarlavhalari, HTTPS majburiy, sirlar faqat env da, formalarga rate-limit, spam himoyasi (§7).
- [ ] `pg_dump` cron bo'yicha avtomatik zaxira + tiklashni tekshirish (§7).
- [ ] Yuklama tekshiruvi va relizga tayyorlik.

## Optional

Bu punktlar loopni bloklamaydi — ular loyiha egasi zimmasida yoki MVP dan tashqarida.

- [ ] Infratuzilma (egasida): YaTT/yuridik shaxs → domen → O'zbekistonda VPS → Docker + PostgreSQL + zaxiralar.
- [ ] Kontent (egasida): kamida 3–5 filtr modeli — foto, xarakteristika, narx, ikki tilda tavsif; kartrijlar ro'yxati resurs oylari bilan; videoobzorlar.
- [ ] Risk tekshiruvi: Kinescope pleerini real iOS va Android da Telegram WebView ichida sinash — barcha videolar yuklanguncha.

## Future Enhancements

MVP ga kirmaydi (§2). Menyuda ko'rsatilmaydi — «tez orada» zaglushkalari yo'q.

- [ ] Filtr tanlash uchun kviz.
- [ ] Servis-markaz bo'limi (biz haqimizda / xizmatlar / narxlar / shikoyatlar).
- [ ] Mijozlar fikr-mulohazalari.
- [ ] Onlayn to'lov va bo'lib to'lash.

## Completed
- [x] Project enabled for Ralph
- [x] Skelet: Next.js 16 + Prisma 7 + PostgreSQL 17, Docker qatlami, marshrut guruhlari, i18n asosi

## Notes
- **Ralph birinchi 16 ta loopni `--dry-run` rejimida ishlatgan** — `status.json` da
  `loop_count: 16, status: success` yozilgan, lekin bitta ham fayl yaratilmagan.
  Progressni `status.json` dan emas, `git log` va shu fayldan tekshiring.
- **Baza ishlayapti, lekin Docker siz va xizmat sifatida emas.** Har safar ishni
  boshlashdan oldin postgres ni qo'lda ko'tarish kerak — buyruqlar `.ralph/AGENT.md`
  dagi «Lokal baza» bo'limida. `docker compose up` hamon sinalmagan.
- **`.env` yaratilmagan.** Ruxsat sozlamalari `.env` ga yozishni taqiqlaydi,
  shuning uchun barcha buyruqlarda `DATABASE_URL` qo'lda berilgan. Ishni qulay
  qilish uchun: `cp env.example .env`.
- **Versiya cheklovlari** `.ralph/AGENT.md` da — TypeScript 6.x va ESLint 9.x
  ataylab `latest` emas. Ko'tarmang, lint buziladi.
- To'liq TZ: `.ralph/specs/requirements.md` (ildizdagi `spec.md` bilan sinxron;
  o'zbekcha tarjimasi — `spec.uz.md`), dastlabki g'oya: `.ralph/specs/original-idea.md`.
- §9 «Открытые вопросы» hal qilinmagan — ular ishni bloklamaydi, lekin tegishli punktga yetganda savolni `RECOMMENDATION` da qayd et.
- Har bir yirik bosqichdan keyin bu faylni yangila.
