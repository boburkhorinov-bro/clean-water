# Ralph Fix Plan — Clean Water

Manba: `.ralph/specs/requirements.md` (§8 «Критический путь»).
Tartib muhim: yuqoridagi punkt tugamaguncha pastdagisiga o'tilmaydi.
Har bir loopda **bitta** punkt bajariladi va shu yerda `- [x]` bilan belgilanadi.

## High Priority

### Skelet (kritik yo'l 3)
- [ ] Next.js (App Router, TypeScript) skeletini yaratish: `src/app`, `src/server`, `src/components`, `src/lib`, `worker/`, `prisma/` — §4.9 dagi tuzilma bo'yicha. ESLint + Prettier + tsconfig strict.
- [ ] `docker-compose.yml`: `web`, `worker`, `postgres`, `nginx` xizmatlari + `.env.example` (§4.1).
- [ ] Prisma schema: `User`, `Product`, `CartridgeSpec`, `Compatibility`, `Lead`, `Installation`, `InstalledPart`, `Notification`, `AuditLog` (§5). Birinchi migratsiya + seed skripti.
- [ ] `(installed_part_id, kind)` bo'yicha unique indeks — takroriy eslatmalarni BD darajasida bloklash (§4.6).
- [ ] Marshrut guruhlari: `(web)/[locale]`, `(miniapp)/app`, `(admin)/admin`, `api/` — bo'sh layoutlar bilan (§4.3).
- [ ] i18n uz/ru: URL da til (`/uz`, `/ru`), `hreflang` + canonical, tarjima yo'q bo'lsa uz ga fallback (§4.7).
- [ ] Telegram avtorizatsiya: `POST /api/auth/telegram` — `initData` HMAC tekshiruvi, `auth_date` < 24h, `User` upsert, JWT httpOnly+Secure+SameSite cookie (§4.4).
- [ ] Telegram Login Widget bilan brauzerdan kirish — o'sha handler, o'sha sessiya (§4.4).
- [ ] `requireAdmin()` server-side guard + `TELEGRAM_ADMIN_IDS` env orqali bootstrap adminlar (§4.4).

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

## Notes
- To'liq TZ: `.ralph/specs/requirements.md`, dastlabki g'oya: `.ralph/specs/original-idea.md`.
- §9 «Открытые вопросы» hal qilinmagan — ular ishni bloklamaydi, lekin tegishli punktga yetganda savolni `RECOMMENDATION` da qayd et.
- Har bir yirik bosqichdan keyin bu faylni yangila.
