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
- [x] `services/` + `repositories/` qatlamlari: biznes-logika React komponentlarida ham, route handler larda ham yozilmaydi (§4.2).
      `repositories/product-repository.ts` (so'rovlar), `services/catalog.ts` (shakllantirish),
      `services/leads.ts`, `services/resolve-client.ts`. 9 integratsiya testi.
- [x] Kontent-bloklar renderi: `heading|paragraph|image|specs|video` tiplari React komponentlariga map qilinadi. `dangerouslySetInnerHTML` hech qayerda ishlatilmaydi (§4.8).
      `lib/content-blocks.ts` (zod sxema, 13 test) + `components/content/ContentBlocks.tsx` (10 test).
      Sxema rasm manzilini `/media/` bilan cheklaydi (`javascript:`, `data:`, tashqi manzil,
      `..` — hammasi rad etiladi) va video id ni harf-raqam bilan (u iframe manziliga tushadi).
      Renderer testi ekranlashni `renderToStaticMarkup` orqali haqiqiy HTML da tekshiradi.
- [x] Filtrlar katalogi: ro'yxat + mahsulot kartochkasi (foto, xarakteristika, narx, Kinescope video, tavsif bloklari). Komponentlar web va Mini App uchun umumiy.
      `/[locale]/filtrlar` (ISR, 60 s) va `/[locale]/filtrlar/[slug]`.
      **ISHLAYOTGAN SERVERDA TASDIQLANDI**: seed mahsuloti chiqdi, narx
      `2 500 000` uzilmas bo'shliq bilan, canonical va hreflang to'g'ri.
- [x] Kartrijlar katalogi: moslik (`Compatibility`) va resurs (`resource_months`) ko'rsatilgan holda.
      `/[locale]/kartrijlar` va `/[locale]/kartrijlar/[slug]`. `/ru/kartrijlar` da
      ruscha nomlar chiqishi tekshirildi.
      Mahsulot sahifasidagi `StageStack` — §3 dagi bosqichlar shkalasi. Raqamlar
      faqat `Compatibility.stage` berilganda chiqadi; seed da u yo'q, shuning uchun
      raqamsiz ro'yxat chiqdi — kutilganidek.
- [x] `POST /api/leads`: zod validatsiya, IP va Telegram ID bo'yicha rate-limit, telefonni `+998XXXXXXXXX` ga normalizatsiya, dublikat mijozni yopishtirish, `Lead(status=new)` yozish — javob shu yerda qaytariladi (§4.5).
      `lib/phone.ts` (15 test), `server/rate-limit.ts` (6 test), `services/leads.ts` (11 integratsiya testi).
      **Dublikat birlashtirish haqiqiy bazada tekshirilgan**: mehmon + Telegram yozuvlari bittaga
      qo'shiladi, arizalar va o'rnatishlar omon qolgan profilga ko'chadi (`resolve-client`, 10 test).
- [x] Menejerlar guruhiga asinxron Telegram xabarnoma + «Ishga olish» inline tugmasi, xatoda qayta urinish. Telegram ishlamasa ham zayavka yo'qolmaydi (§4.5).
      `server/telegram/notify-manager.ts`, 12 test. Xabar Telegram HTML rejimida ketadi,
      shuning uchun mijoz ismi va izohi ekranlanadi. 429 da Telegram bergan `retry_after`
      hurmat qilinadi.
      **Eng muhim tekshiruv**: xabarnoma yiqilsa HAM, osilib qolsa HAM ariza bazada qoladi
      va mijozga muvaffaqiyat qaytariladi.

### Admin panel (kritik yo'l 5)
- [x] Adminka: mahsulotlar CRUD (filtrlar va kartrijlar, ikki tilda).
      `services/admin-products.ts` (30 integratsiya testi), `api/admin/products` (14 test),
      `(admin)/admin/mahsulotlar` — ro'yxat, forma, tahrirlash.
      **O'chirish YO'Q, ARXIVLASH bor** (`isActive=false`): mahsulotga `Lead` va
      `Installation` bog'langan bo'lishi mumkin va ularning tarixi buzilmasligi kerak.
      Admin ro'yxati katalogdan farqli — arxivlanganlarni ham ko'rsatadi, aks holda
      ularni qaytarib bo'lmasdi.
      **Resurssiz kartrij rad etiladi** — `due_at` usiz hisoblanmaydi va bunday kartrij
      eslatmasiz qolib ketardi (§5). Bu CRM va eslatmalar bilan bir xil qoida.
      Ruscha nom bo'sh qolsa o'zbekchasi yoziladi (§4.7).
- [x] Kontent-bloklar vizual muharriri (ixtiyoriy HTML qabul qilinmaydi; saqlashda sanitizatsiya).
      `lib/block-editor.ts` (16 birlik testi) + `components/admin/BlockEditor.tsx`.
      Muharrirda ixtiyoriy HTML maydoni YO'Q — u faqat tiplashtirilgan bloklarni yasaydi,
      har bir maydon o'z turiga mos kirish elementiga bog'langan.
      **Test qoidasi**: muharrir yasagan har qanday bo'sh blok `contentBlocksSchema` dan
      o'tishi shart (rasm `/media/`, video id harf-raqam) — aks holda admin formani
      to'ldirib bo'lib, saqlashda tushunarsiz xatoga urilardi.
      Validatsiya SAQLASHDA, serverda takrorlanadi: klientdagi cheklov himoya emas.
- [x] Zayavkalar bilan ishlash: `new → in_work → done | rejected` statuslari.
      `services/admin-leads.ts` (21 integratsiya testi), `api/admin/leads/[id]/status` (6 test),
      `(admin)/admin/arizalar`.
      Oqim qat'iy: `NEW → DONE` **rad etiladi** — ishga olinmagan ariza bajarilgan bo'la
      olmaydi va statistika yolg'on bo'lardi. `DONE` yakuniy holat.
      Orqaga qaytish cheklangan holda ruxsat: `IN_WORK → NEW`, `REJECTED → NEW` —
      menejer tugmani xato bosishi odatiy hol.
      Taqiqlangan o'tish HTTP da 400 emas, **409**: so'rov to'g'ri, arizaning holati
      yo'l bermayapti — interfeys «sahifani yangilang» deydi.
- [x] `AuditLog` — har bir admin harakati yoziladi (§7).
      `services/audit.ts` (8 birlik testi) + `(admin)/admin/jurnal`.
      Yozuv asosiy amal bilan **bitta tranzaksiyada**: to'liq bo'lmagan jurnal jurnal emas.
      Qamrov: `product.create/update/archive/restore`, `lead.status`,
      `installation.create`, `part.replace`.
      Payload dan sirlar **kalit nomi bo'yicha** olib tashlanadi (`token`, `secret`,
      `password`, `apiKey`…) — jurnal panelda ko'rinadi va zaxiraga tushadi.
      Filtr oq emas, qora ro'yxat: yangi maydon jurnalga o'z-o'zidan tushadi.
      Jurnal faqat o'qiladi — panelda tahrirlash yoki o'chirish yo'q.

**CRM ekranlari shu bosqichda yopildi.** Kritik yo'l 6 da servis qatlami yozilgan edi,
lekin menejer uchun ekran yo'q edi: `(admin)/admin/mijozlar` (ro'yxat va kartochka),
`api/admin/installations` (6 test), `api/admin/parts/[id]/replace` (6 test),
`InstallationForm` va `ReplacePartButton`.
**Sanalar Toshkent kalendarida o'qiladi** (`parseTashkentDate`): menejer formaga mahalliy
sanani yozadi va u `due_at` ga to'g'ridan-to'g'ri ta'sir qiladi. `new Date('2026-02-15')`
uni UTC yarim tuni deb olardi va kun chegarasida muddat siljirdi.

**ISHLAYOTGAN SERVERDA TASDIQLANDI**: sessiyasiz barcha admin sahifalari 404,
admin sessiyasi bilan 200. Kartrij almashtirilgani HTTP orqali belgilandi — eski qator
yopildi, yangisi to'g'ri `due_at` bilan yaratildi, jurnalga `part.replace` tushdi va
kartochkada «183 kun qoldi» ko'rindi.

**RECOMMENDATION (§9 dagi ochiq savol):** admin panel matnlari o'zbekcha, `lang="uz"`
(avval `lang="ru"` edi). Sabab: loyihaning butun hujjatlashtiruvi va kod bazasi
o'zbekcha. Menejerlar ruscha ishlashi ma'lum bo'lsa, bu bir joyda — `admin/layout.tsx`
dagi menyu va sahifa matnlarida — o'zgartiriladi.

### CRM (kritik yo'l 6)
- [x] Mijozlar bazasi, telefon bo'yicha dublikatlarni yopishtirish (bitta mijozda bir nechta `Installation` bo'lishi mumkin).
      `repositories/client-repository.ts` + `services/clients.ts` (17 integratsiya testi).
      Qidiruv satri bitta: menejer raqamni mijoz aytganicha yozadi (`+998 90 123-45-67`,
      `901234567`, oxirgi 4 raqam) yoki ismni kiritadi — servis o'zi ajratadi.
      Dublikat birlashtirish qayta yozilmadi: `registerClient` `resolveLeadClient` ni
      chaqiradi, ya'ni CRM da qo'lda qo'shilgan mijoz Telegramdan kelganida ikkinchi
      yozuv paydo bo'lmaydi.
- [x] O'rnatishlarni qayd qilish: `Installation` + `InstalledPart`, `due_at` = `installed_at` + shu kartrijning `resource_months` (zayavka sanasidan emas).
      `services/installations.ts` — `registerInstallation` (15 integratsiya testi),
      `lib/due-date.ts` (17 birlik testi).
      **Hisob Toshkent kalendari bo'yicha** — O'zbekiston qat'iy UTC+5, yozgi vaqt yo'q.
      UTC da hisoblansa oy oxirlarida bir kunlik siljish chiqadi (test bilan qopqoq).
      Oy oxiri qisqartiriladi: 31-yanvar + 1 oy = 28-fevral (kabisa yilida 29),
      `Date.setMonth` kabi 3-martga to'kilmaydi.
      Kartrijning o'z sanasi bo'lishi mumkin: apparat avgustda, membrana oktabrda
      qo'yilgan bo'lsa, muddat oktabrdan sanaladi.
      Resurssiz (`CartridgeSpec` yo'q) kartrij **rad etiladi** — u eslatmasiz qolib ketardi.
      Yozuv tranzaksiyada: bitta kartrij yaroqsiz bo'lsa, o'rnatish ham yozilmaydi.
      `Compatibility` ataylab tekshirilmaydi — jadval to'liq bo'lmasligi mumkin,
      usta esa haqiqatda qo'yilgan kartrijni yozishi kerak.
- [x] Kartrij almashtirilganini belgilash (`replaced_at`) va keyingi `due_at` ni hisoblash.
      `markPartReplaced` (14 integratsiya testi).
      **Eski qator yopiladi, o'rniga YANGISI yaratiladi.** Qator qayta ishlatilmaydi,
      chunki eslatmalar idempotentligi `(installed_part_id, kind)` unikal indeksida —
      bir qatorda keyingi sikl eslatmalari dublikat sifatida rad etilardi.
      **Keyingi `due_at` almashtirish sanasidan hisoblanadi, eski `due_at` dan emas:**
      mijoz kechikib almashtirsa, yangi kartrij o'sha kundan ishlaydi va jadval suriladi.
      Boshqa modelga almashtirilsa — yangi modelning resursi. Ikkinchi marta
      almashtirishga urinish rad etiladi (aks holda ikkita «amaldagi» kartrij qolardi).

### Eslatmalar va «Mening filtrim» (kritik yo'l 7)
- [x] Worker: har kuni 09:00 (Toshkent) — `due_at` gacha 30/7/0 kun qolgan `InstalledPart` larni tanlaydi, idempotentlik unique indeks bilan, `429` da `retry_after` ga rioya qiladi (§4.6).
      `worker/jobs/schedule.ts` (11 test), `services/reminders.ts` (22 test),
      `services/reminder-sweep.ts` (17 integratsiya testi).
      **Chegara «aynan teng» emas, «o'tilgan»**: worker bir kun ishlamay qolsa
      (konteyner qayta yuklandi), tenglik bo'yicha qidiruv o'sha eslatmani butunlay
      o'tkazib yuborardi.
      **Bir vaqtda faqat ENG SHOSHILINCH turi ketadi**: uch kun qolganda «30 kun qoldi»
      va «7 kun qoldi» ni birga yuborish spam.
      Xabar matni HAQIQIY qolgan kunlarni aytadi, chegara raqamini emas (§3 qoidasi).
      Nosozlikda satr `FAILED` bo'lib qoladi va **ertasi kuni qayta olinadi** — yangi satr
      yaratilmaydi, unikal indeks ruxsat bermaydi va eslatma butunlay yo'qolardi.
      429 da o'tish to'xtaydi va qolgani keyingi o'tishga qoladi (cheklov botga umumiy).
      Telegram siz mijoz o'tkazib yuboriladi va satr YARATILMAYDI: u keyinchalik
      Mini App ga kirsa, eslatma o'sha zahoti tiklanishi kerak.
      Rejalashtiruvchi `TZ` ga bog'liq emas — Toshkent siljishi kodda.
- [x] Telegram bot: `worker` konteynerida webhook, «Заказать замену» tugmasi darhol zayavka yaratadi.
      `worker/bot/webhook.ts` (15 test), `services/replacement-request.ts` (9 integratsiya
      testi), `telegram/bot-api.ts` (8 test). nginx `/telegram/webhook` → `worker:8081`.
      **HAQIQIY SERVERDA TASDIQLANDI**: worker ko'tarilib, `callback_query` yuborildi —
      egasi bosganda ariza bazada paydo bo'ldi (`MINIAPP/NEW`, izohda o'rnatish manzili),
      begona odam bosganda esa yaratilmadi.
      Xavfsizlik: `installed_part_id` `callback_data` da keladi, ya'ni uni istalgan odam
      yasashi mumkin — egalik SERVERDA tekshiriladi. Sir sozlanmagan bo'lsa webhook
      butunlay yopiq (401), chunki sirsiz u ochiq ariza generatori bo'lardi.
      Takroriy bosish (eski xabardagi tugma) dublikat ariza bermaydi — 24 soatlik oyna.
- [x] «Mening filtrim» ekrani: o'rnatilgan apparat, kartrijlar, real ma'lumotdan hisoblangan resurs shkalasi, almashtirishga buyurtma tugmasi.
      `services/my-filter.ts` (10 birlik + 8 integratsiya testi),
      `components/my-filter/ResourceBar.tsx` (7 test),
      `api/my-filter/replace` (8 integratsiya testi), `(miniapp)/app/mening-filtrim`.
      **Shkala dekorativ emas**: kengligi `installed_at` va `due_at` orasidagi haqiqiy
      nisbatdan. Shuning uchun u `role="progressbar"` bilan e'lon qilinadi va ekran
      o'quvchisiga aynan o'sha son beriladi.
      Muddat o'tgan bo'lsa shkala 100% da to'xtaydi, kunlar esa manfiy ko'rsatiladi.
      Buzuq ma'lumotda (`due_at` = `installed_at`) nolga bo'linmaydi.
      Almashtirilgan kartrijlar ekranda yo'q — u «hozir nima turibdi» ga javob beradi.
      Buyurtma tugmasi faqat muddat yaqinlashganda (`SOON`/`DUE`): doim ko'rsatilsa,
      u yangi kartrijni ham almashtirishga undardi.

### UI va dizayn (kritik yo'l 8)
- [x] Dizayn-tokenlar: Montserrat, och ko'k + binafsha palitra, yorug'/qorong'i tema (Mini App da tema Telegram dan olinadi, qo'lda almashtiriladi).
      `src/app/tokens.css`, `src/app/fonts.ts`, `src/lib/theme.ts` (7 test),
      `components/ui/ThemeToggle.tsx` + `theme-store.ts`, `TelegramTheme.tsx`.
      **Bu punkt katalog UI dan OLDIN bajarildi** (reja tartibidan chetlanish):
      tokensiz yozilgan sahifalar keyin qayta yozilardi.
      Montserrat `next/font` orqali — CSP `font-src 'self'` tashqi yuklashni
      bloklaydi. Qurilgan HTML da tekshirilgan: tashqi so'rov yo'q.
      Mavzu ustunligi: qo'lda tanlov > Telegram > tizim.
- [x] Dashboard: banner «CLEAN WATER ga xush kelibsiz» + katalogga o'tish. Dekorativ progress-shkala yo'q — faqat real ma'lumot.
      Sayt: `(web)/[locale]/page.tsx` — banner, katalogga o'tish, katalogdagi
      **haqiqiy** mahsulotlar (ISR 60 s, SEO uchun kontent).
      Mini App: `(miniapp)/app/page.tsx` — banner va mijozning **eng shoshilinch
      kartriji** (`services/dashboard.ts`, 7 test). O'rnatish qayd etilmagan bo'lsa
      blok umuman ko'rsatilmaydi — bo'sh shkala chizilmaydi.
      Dastlabki g'oyadagi «o'z-o'zidan to'ladigan» modul shkalalari YO'Q (§3).
      «3D banner» o'rniga palitradagi gradient: rasm yuklanguncha sahifa siljirdi
      va SEO uchun foyda bermasdi.
- [x] Responsive tekshiruv + PWA manifest.
      `app/manifest.ts` (PWA), `app/robots.ts`, `app/sitemap.ts` (ikki til,
      `alternates` bilan), `public/icon.svg`, `viewport` ikkala layoutda.
      PWA **saytga** tegishli — Mini App Telegram ichida ishlaydi va unga manifest
      kerak emas. `start_url: /uz`: `/` ni proxy yo'naltiradi va PWA ochilishida
      ortiqcha redirect bo'lardi.
      **TOPILGAN VA TUZATILGAN XATO**: `proxy.ts` matcheri fayllarni NOM bo'yicha
      sanab chiqqan va `manifest.webmanifest`, `icon.svg` ro'yxatga kirmay qolgan —
      ular `/uz/...` ga yo'naltirilgan. Brauzer 307 ni kuzatib HTML olgan va uni
      jimgina tashlab yuborgan: PWA manifesti ham, favicon ham ishlamagan.
      Endi qoida umumiy — «nuqtasi bor yo'l fayl», va u `src/proxy.test.ts` (8 test)
      bilan mustahkamlangan.
      Responsive: tartiblar `auto-fit` grid va `flex-wrap` da (media query siz
      moslashadi), jadvallar `overflow-x: auto` ichida. Qo'shimcha media query lar —
      blok muharriri (4 ustun → 2), o'rnatish formasi, admin menyusi.
      **TEKSHIRILMAGAN: haqiqiy qurilmada** — bu mashinada brauzer avtomatizatsiyasi
      yo'q. CSS darajasida ko'rib chiqilgan, telefon va planshetda ko'z bilan
      tekshirish kerak.

### Ishga tushirishdan oldin (kritik yo'l 9)
- [x] Xavfsizlik: CSP sarlavhalari, HTTPS majburiy, sirlar faqat env da, formalarga rate-limit, spam himoyasi (§7).
      `lib/security-headers.ts` (15 test) + `next.config.ts`, `server/env.ts` (17 test),
      `server/form-token.ts` (14 test), `api/form-token` (3 test), `instrumentation.ts` (3 test),
      `LeadForm` honeypot (8 test), `api/leads` spam to'siqlari (+7 integratsiya testi),
      nginx konfiguratsiyasi (11 test).
      **CSP endi ILOVADA, nginx unda emas.** Avval u faqat nginx da edi va
      `npm start` bilan ishga tushirilgan ilova butunlay himoyasiz qolardi.
      nginx darajasida sarlavhalar TAKRORLANMAYDI: ikkita farqli CSP brauzerda
      kesishadi va nginx dagi eskirgan siyosat ilovaning yangi ruxsatlarini
      jimgina bloklardi. Yagona istisno — `/media/`, u ilovadan o'tmaydi va
      o'zining eng qattiq siyosatini oladi (`default-src 'none'; sandbox`).
      **`X-Frame-Options` OLIB TASHLANDI**: `SAMEORIGIN` Telegram Web dagi
      Mini App ni bloklardi. Ramkalar faqat CSP `frame-ancestors` bilan.
      `img-src` `https:` dan `'self' data:` ga toraytirildi — kontent-bloklar
      sxemasi tashqi rasmga baribir yo'l qo'ymaydi.
      HTTPS: `tls.conf.disabled` (80 → 301, HSTS, TLSv1.2+), location lar
      `app_locations.inc` da — ikkala server bloki uchun bitta nusxa.
      Env: prodda sir bo'sh yoki namuna qiymati bo'lsa **ilova ko'tarilmaydi**
      (`web` uchun `instrumentation.ts`, `worker` uchun `main()`). Dev da
      ogohlantirish. Xato xabarida sir qiymati ko'rinmaydi — u log ga tushadi.
      **Spam: CAPTCHA emas, honeypot + imzolangan forma tokeni.** CAPTCHA har
      bir haqiqiy mijozga soliq soladi. Token `GET /api/form-token` dan olinadi
      (sahifaga qo'yib bo'lmasdi — ISR uni HTML ga muzlatib qo'yardi) va
      to'ldirishga sarflangan vaqtni o'lchaydi: 3 soniyadan tez yuborilgan
      forma rad etiladi. Vaqt HMAC bilan imzolangan, ya'ni klient uni
      soxtalashtira olmaydi.
      Honeypot rad etilishi oddiy validatsiya xatosidan **farq qilmaydi**
      (`invalid_lead`) — bot to'siqni payqamasligi kerak. Token muammosi esa
      alohida kod (`stale_form`), chunki uni mijozning o'zi hal qiladi.
      **ISHLAYOTGAN SERVERDA TASDIQLANDI**: `/uz` javobida to'liq CSP
      (dev da `'unsafe-eval'` bilan, HSTS siz), 144 ms yoshdagi token 400
      bilan rad etildi, 4.5 s dan keyin o'sha oqim 201 berdi, honeypot bilan
      400, token javobida `Cache-Control: no-store`.
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
