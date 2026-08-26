# Loyiha egasi bajaradigan ishlar

Kod tayyor: kritik yo'l (TZ §3–§9) yopilgan, 708 test o'tadi (438 birlik +
270 integratsiya, 2026-08-19 da tekshirilgan). Pastdagilar —
faqat siz bajara oladigan ishlar: ular tashqi hisoblar, pul, jismoniy
qurilmalar yoki biznes qarorlarini talab qiladi.

**2026-08-19 da yopilgan kod bo'shliqlari** (endi sizdan hech narsa
talab qilmaydi):

- Telefonsiz Mini App mijozi boshi berk ko'chada qolmaydi: botda
  «Raqamni yuborish» tugmasi (`request_contact` — raqamni Telegram o'zi
  beradi), botda `/start`, va «Mening filtrim» ekranida forma.
  **Deployda diqqat:** `setWebhook` da `allowed_updates` ichida `message`
  bo'lishi shart, aks holda kontakt botga yetib bormaydi
  ([DEPLOY.md §5](DEPLOY.md)) — `scripts/deploy.sh` buni o'zi qiladi.
- **Hisobni egallab olish yo'li yopildi** (quyida batafsil).
- Mahsulot sahifalari ISR ga o'tkazildi (yuklama ostida ~5 barobar sekin edi).
- **Deploy zanjiridagi uchta tuzoq yopildi** — ular birinchi urinishda,
  serverda ko'rinardi:
  1. migratsiyalar `web` konteyneri ichida chaqirilardi, u yerda esa
     `prisma` CLI ham, migratsiya fayllari ham yo'q — endi ular alohida
     bir martalik `migrate` xizmatida ishlaydi va `up` ning o'zi yetarli;
  2. sertifikat volumei nomi papka nomiga bog'liq edi — Compose loyiha
     nomi qat'iy belgilandi (`cleanwater`);
  3. `.env` da `DATABASE_URL` `localhost` ga qarasa yoki parollar ajralib
     qolsa, skript endi BOSHIDA to'xtaydi — avval buni obrazlar qurilib,
     sertifikat olinganidan keyin bilib olardik.

### Menejerlar bilishi kerak: raqam qachon birlashadi

Ilgari telefon raqami shaxsni aniqlashning yagona kaliti edi va bu hisobni
egallab olish yo'li bo'lgan: Telegram orqali kirgan istalgan odam ariza
formasiga boshqa mijozning raqamini yozsa, o'sha mijozning o'rnatishlari
(manzili bilan), arizalari va eslatmalari unga ko'chib o'tardi, mijozning
yozuvi esa o'chib ketardi. Raqamni bilish qiyin emas.

Endi ikkita yozuvni birlashtirish faqat raqam **tasdiqlangan** bo'lsa
bajariladi:

| Raqam qayerdan keldi | Birlashtiradimi |
|---|---|
| Botdagi «Raqamni yuborish» tugmasi | ha — raqamni Telegram beradi |
| CRM (menejer kiritadi) | ha — ortida qo'ng'iroq va haqiqiy odam |
| Sayt/Mini App formasi (qo'lda yozilgan) | **yo'q** |

Amalda bu nimani anglatadi:

- **Ariza hech qachon yo'qolmaydi.** Qo'lda yozilgan raqam boshqa mijozniki
  bo'lsa ham ariza yaratiladi va raqam unda ko'rinadi — siz uni ko'rasiz va
  kerak bo'lsa CRM da qo'lda birlashtirasiz.
- **Mijoz «Mening filtrim» ni bo'sh ko'rsa**, uning Telegram yozuvi CRM
  yozuvidan ajralgan. Yechim: mijoz botga `/start` yuboradi va raqamini
  tugma orqali jo'natadi — shundan keyin ikkalasi birlashadi.
- CRM da o'rnatish yozayotganda raqamni to'g'ri kiritish avvalgidek muhim.

Tartib muhim: yuqoridagi bloklar pastdagilarni bloklaydi.

---

## 1. Sirlar

**Qaror (2026-08-20): Vercel + Render + Neon.** Bosqichma-bosqich tartib —
[DEPLOY-PAAS.md](DEPLOY-PAAS.md).

Bu yo'lda ildizdagi `.env` faqat **lokal ishlab chiqish** uchun qoladi.
Prod qiymatlar uchta panelda kiritiladi (Vercel, Render, Neon) va
repozitoriyga umuman tushmaydi.

Yaratish kerak bo'lgan sirlar:

- [x] `JWT_SECRET` — yaratildi va Vercel ga qo`yildi (64 belgi)
- [x] `TELEGRAM_WEBHOOK_SECRET` — yaratildi (Render ga kiritilishi qoldi)
- [x] `CRON_SECRET` — yaratildi (Render va cron xizmatiga kiritilishi qoldi)

- [x] **`NEXT_PUBLIC_SITE_URL`** — `https://cleanwater-two.vercel.app`,
      buildda muhrlangani `robots.txt`, `sitemap.xml` va canonical bilan
      tasdiqlandi (2026-08-26).
      Bu qiymat **qurish paytida kodga muhrlanadi**: uni keyin
      o'zgartirsangiz, qayta deploy qilish shart. Aks holda canonical,
      hreflang, `robots.txt` va `sitemap.xml` eski manzilda qoladi —
      sayt ishlaydi, buzilish esa faqat qidiruv indeksida ko'rinadi.

**Telegram sozlamalari tugallangan** (2026-08-18): bot tokeni, admin ID lar va
menejerlar guruhi `.env` da, guruh ID si manfiy, bot unda administrator.
Haqiqiy hisob bilan tekshirilgan: sinov arizasi guruhga yetib bordi, eslatma
mijozga ketdi (idempotentligi ham). Prodda boshqa guruh ishlatilsa, ID
qoidasi — [DEPLOY-PAAS.md §5](DEPLOY-PAAS.md).

Qolgan ikkita Telegram zanjiri **domensiz sinab bo'lmaydi**: bot webhooki
(«Almashtirishga buyurtma» tugmasi) va Mini App avtorizatsiyasi — ikkalasi
ham public HTTPS manzilni talab qiladi.

---

## 2. Infratuzilma

**Qaror (2026-08-20): Vercel + Render + Neon.** Server boshqarilmaydi,
domen ham shart emas — Vercel o'z manzilini beradi. Bosqichma-bosqich
tartib: [DEPLOY-PAAS.md](DEPLOY-PAAS.md).

Oracle + Docker varianti bekor qilinmadi, u [DEPLOY.md](DEPLOY.md) va
[DEPLOY-FREE.md](DEPLOY-FREE.md) da ishlaydigan holatda qoladi.

- [x] **Neon** — loyiha yaratildi (`ap-southeast-1`, Singapur — qaror
      2026-08-25; Render va Vercel ham shu mintaqaga qaratildi).
      Ikkita ulanish satri kerak:
      **pooled** (ilova uchun) va **direct** (migratsiya uchun). Migratsiya
      pooled satr bilan ishlamaydi — sabab DEPLOY-PAAS.md §1 da.

- [x] **Vercel** — loyiha `cleanwater`, domen `cleanwater-two.vercel.app`,
      funksiyalar mintaqasi `sin1`, env lar to'ldirilgan (2026-08-26).
      Import qilingan repozitoriya: `boburkhorinov-bro/clean-water`.
      **Hobby rejasi shartlarida tijoriy foydalanish taqiqlangan** va bu
      platforma o'sha ta'rifga tushadi (mahsulot sotiladi, sayt yaratilishi
      uchun haq to'langan). Hobby bilan ishlash sizning qaroringiz
      (2026-08-20); xavf — hisob to'xtatilishi. Rasmiy yo'l Pro, $20/oy.

- [x] **Render** — `cleanwater-worker` yaratildi (`singapore`, `free`),
      manzil `https://cleanwater-worker.onrender.com`. Sakkizta env
      o'zgaruvchi API orqali qo'yildi (2026-08-26).

- [x] **cron-job.org** — ikkita ish yaratildi (2026-08-26): 08:55 isitish
      (`GET /health`) va 09:00 eslatmalar (`POST /jobs/reminders`), Toshkent
      vaqti bo'yicha. Isitish ishi shart: sovuq Render ~50 soniyada
      uyg'onadi, cron chegarasi esa 30 soniya — DEPLOY-PAAS.md §4.

- [ ] **YaTT yoki yuridik shaxs** — to'lov yo'q bo'lsa ham, biznes sifatida
      ishlash uchun.

- [ ] **Kinescope hisobi** (bepul reja: 100 daqiqa, 200 GB/oy, kartochkasiz).

---

## 3. Kontent

Hozir bazada faqat demo seed: 1 filtr va 3 kartrij. Ular bilan saytni
ochib bo'lmaydi.

- [ ] Kamida **3–5 filtr modeli**: foto, xarakteristika, narx, ikki tilda
      tavsif (ruscha bo'sh qolsa o'zbekchasi ishlatiladi).
- [ ] **Kartrijlar ro'yxati** — har biriga **resurs oylari** ko'rsatilgan
      bo'lishi shart. Resurssiz kartrij tizim tomonidan rad etiladi: usiz
      almashtirish muddati hisoblanmaydi va mijoz eslatmasiz qolardi.
- [ ] **Moslik jadvali** (qaysi kartrij qaysi filtrga) va imkon bo'lsa
      bosqich tartibi — usiz mahsulot kartochkasida raqamsiz ro'yxat chiqadi.
- [ ] **Videoobzorlar** Kinescope ga yuklanadi, admin panelga faqat video id
      kiritiladi.

Hammasi admin panel orqali kiritiladi, kod tegishi shart emas.

---

## 4. Deploy

Batafsil tartib — [DEPLOY-PAAS.md](DEPLOY-PAAS.md), cheklist §7 da.
Docker/VPS varianti uchun — [DEPLOY.md](DEPLOY.md), cheklist §10 da.

- [x] Neon: migratsiyalar **direct** satr bilan qo'llandi (2 ta), natija
      pooled satr bilan tekshirildi — 10 jadval. Demo seed ham yuklandi.
- [x] Vercel: env lar to'ldirilgan, `/api/health` → `{"status":"ok"}`
- [x] Render: sirlar kiritilgan, `/health` → `ok` (HTTP 200).
      `POST /jobs/reminders`: sirsiz 401, noto'g'ri sir 401, to'g'ri sir 200
      va `{"sent":0,"skipped":0,"failed":0}` — ya'ni bazaga ulanadi.
- [x] Telegram webhook worker manziliga o'rnatildi (bot @cvseller_bot).
      `getWebhookInfo`: `last_error_message` yo'q,
      `allowed_updates=["message","callback_query"]` — ikkalasi ham bor.
- [x] Mini App Vercel domeniga ulandi: menyu tugmasi `web_app` turida,
      `https://cleanwater-two.vercel.app/app`. `/start` buyrug'i ham
      Telegram ro'yxatiga qo'shildi (`setMyCommands`).
- [x] cron-job.org da **ikkita** ish: 08:55 isitish (`GET /health`) va
      09:00 eslatmalar (`POST /jobs/reminders`), Toshkent vaqti. Qo'lda
      sinaldi — Render logida o'tish ko'rindi.
- [x] Menejerlar guruhiga sinov arizasi keldi (2026-08-26, egasi tasdiqladi).
      Ariza bazada ham bor: `bf1cc7fc-b11c-406a-8c30-cbcb4aed24e4`.
- [x] `sh scripts/smoke.sh https://cleanwater-two.vercel.app` — 15/15 o'tdi
      (2026-08-26)
- [ ] **Zaxira**: Neon panelidagi tiklash oynasi ko'rildi va bir marta
      qo'lda dump olindi. Bepul xizmatlarda SLA yo'q.
      **Bloklangan (2026-08-26):** `pg_dump` 17.11 Neon ning 18.6 serveridan
      dump olishni rad etadi. Avval PostgreSQL 18 mijoz vositalari kerak —
      [DEPLOY-PAAS.md §6](DEPLOY-PAAS.md). Shungacha yagona himoya — Neon ning
      o'z tiklash oynasi.
- [ ] **Sirlarni yangilash**: deploy jarayonida yozishmaga tushgan ikkita
      qiymat — Neon `neondb_owner` paroli va `CRON_SECRET`.
      Neon → Roles → Reset password, so'ng Vercel va Render dagi
      `DATABASE_URL`; `CRON_SECRET` esa Render da va cron-job.org dagi
      ikkinchi ishning sarlavhasida yangilanadi. Shoshilinch emas, lekin
      qilingani ma'qul.

---

## 5. Faqat siz tekshira oladigan narsalar

Bu mashinada brauzer avtomatizatsiyasi ham, haqiqiy qurilma ham yo'q.

- [ ] **Kinescope pleeri haqiqiy iOS va Android da, Telegram WebView
      ichida.** Bu TZ §9 dagi ochiq risk — WebView cheklovlari tufayli video
      ishlamay qolishi mumkin, va bunda mahsulot kartochkasining bir qismi
      yo'qoladi.
- [ ] **Responsive** — telefon va planshetda ko'z bilan. CSS darajasida
      ko'rib chiqilgan (`auto-fit` grid, `flex-wrap`, jadvallar
      `overflow-x: auto` da), lekin qurilmada sinalmagan.
- [ ] **`docker compose up`** — bu mashinada hech qachon ishga tushmagan
      (Docker Desktop 3.8 GB xotirada ko'tarilmaydi). Serverdagi birinchi
      ishga tushirish ayni paytda birinchi sinov bo'ladi.

---

## 6. Qaror talab qiladigan savollar

- [ ] **Admin panel tili.** Hozir o'zbekcha (`lang="uz"`). Menejerlar ruscha
      ishlasa, bu bitta joyda o'zgartiriladi — `admin/layout.tsx`.
- [ ] **`spec.md` §4.4 eskirgan.** Telegram sayt loginini OpenID Connect ga
      ko'chirgani uchun Login Widget MVP dan chiqarilgan (2026-08-14), lekin
      asl TZ hali eski holatda. Hujjatni yangilash — sizning qaroringiz,
      men buyurtmachi hujjatlariga tegmayman.
- [x] ~~**Dinamik mahsulot sahifasi** yuklama ostida ~5 barobar sekin~~ —
      hal qilindi (2026-08-19): mahsulot sahifalari ham ISR ga o'tkazildi
      (`revalidate = 60`, ro'yxatlar bilan bir xil). Admin panelda
      tahrirlangan mahsulot bir daqiqagacha eski ko'rinishi mumkin.

---

## Ma'lum cheklovlar (ataylab qabul qilingan)

Bular xato emas, lekin bilib turishingiz kerak:

- **Rate-limit jarayon xotirasida** — `web` bir nechta instansda ishga
  tushsa, amaldagi limit instanslar soniga ko'payadi.
  **Vercel da bu odatiy hol, istisno emas:** serverless instanslar ko'p va
  qisqa umrli, ya'ni cheklov deyarli ishlamaydi. nginx dagi `limit_req`
  qatlami ham PaaS da yo'q. Ariza formasida honeypot va imzolangan forma
  tokeni qoladi (§6) — ular botlarni to'sadi, oddiy flood ni esa yo'q.
- **Forma tokeni qayta ishlatilishi mumkin** — bir martalik token umumiy
  holat saqlashni (Redis) talab qilardi, u MVP da yo'q.
- **Sessiyani darhol bekor qilib bo'lmaydi** — JWT bazada saqlanmaydi,
  shuning uchun amal muddati 24 soat.
