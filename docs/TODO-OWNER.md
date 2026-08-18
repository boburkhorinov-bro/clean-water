# Loyiha egasi bajaradigan ishlar

Kod tayyor: kritik yo'l (TZ §3–§9) yopilgan, 621 test o'tadi (370 birlik +
251 integratsiya, 2026-08-18 da tekshirilgan). Pastdagilar —
faqat siz bajara oladigan ishlar: ular tashqi hisoblar, pul, jismoniy
qurilmalar yoki biznes qarorlarini talab qiladi.

Tartib muhim: yuqoridagi bloklar pastdagilarni bloklaydi.

---

## 1. Hozir `.env` da tuzatish kerak

Fayl mavjud va deyarli to'liq. Ikkita muammo qoldi.

- [ ] **`NEXT_PUBLIC_SITE_URL`** — hozir `http://localhost:3000`.
      Haqiqiy `https://<domen>` bo'lishi shart.
      **Domen tanlanmaguncha obrazni qurib bo'lmaydi** — bu qiymat qurish
      paytida kodga muhrlanadi, keyin o'zgartirib bo'lmaydi
      ([DEPLOY.md §2](DEPLOY.md)). Docker build noto'g'ri qiymatda
      ataylab to'xtaydi.

- [ ] **`POSTGRES_PASSWORD`** — hozir `cleanwater` (ishlab chiqish uchun).
      Prodda kuchli parol qo'ying va uni `DATABASE_URL` ichiga ham yozing —
      ikki joyda bir xil bo'lishi shart.
      Parolni **hex** da yarating, base64 da emas: base64 dagi `+` va `/`
      belgilar ulanish satrini buzadi.
      `openssl rand -hex 18`

**Telegram sozlamalari tugallangan** (2026-08-18): bot tokeni, admin ID lar va
menejerlar guruhi `.env` da, guruh ID si manfiy, bot unda administrator.
Haqiqiy hisob bilan tekshirilgan: sinov arizasi guruhga yetib bordi, eslatma
mijozga ketdi (idempotentligi ham). Prodda boshqa guruh ishlatilsa, ID
qoidasi — [DEPLOY.md §2](DEPLOY.md) jadvalida.

Qolgan ikkita Telegram zanjiri **domensiz sinab bo'lmaydi**: bot webhooki
(«Almashtirishga buyurtma» tugmasi) va Mini App avtorizatsiyasi — ikkalasi
ham public HTTPS manzilni talab qiladi.

---

## 2. Infratuzilma

**Qaror (2026-08-18): nol byudjet yo'li.** Sotuv asosan Telegram orqali
bo'lgani uchun bepul subdomen yetarli — mijoz manzilni ko'rmaydi ham.
Bosqichma-bosqich tartib: [DEPLOY-FREE.md](DEPLOY-FREE.md) «Amaliy qadamlar».

- [ ] **Bepul subdomen** — DuckDNS da nom oling (kartasiz, ~5 daqiqa).
      Let's Encrypt unga sertifikat beradi, Mini App to'liq ishlaydi.
      Keyinchalik o'z domeningizga o'tsangiz obrazni **qayta qurish** shart.

- [ ] **Server** — Oracle Cloud Always Free (2 OCPU / 12 GB ARM).
      Mavjud `docker-compose.yml` o'zgarishsiz ishlaydi, ARM mosligi
      tekshirilgan. Ro'yxatdan o'tishda karta so'raladi (pul yechilmaydi).
      **Diqqat:** Oracle 2026-yil iyunida limitni ikki barobar qisqartirgan;
      yangi instansni darhol 2/12 doirasida yarating.
      «Out of host capacity» — kutilgan xato, hisobda muammo emas:
      boshqa availability domain yoki keyinroq qayta urinish.

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

Batafsil tartib — [DEPLOY.md](DEPLOY.md). Cheklist §10 da.

- [ ] `.env` to'ldirilgan, sirlar generatsiya qilingan
- [ ] `docker compose ps` — barcha xizmatlar `healthy`
- [ ] Migratsiyalar qo'llangan (`prisma migrate deploy`)
- [ ] TLS ishlaydi, HTTP → HTTPS, HSTS sarlavhasi bor
- [ ] `sh scripts/smoke.sh https://<domen>` — 15 tekshiruv o'tadi
- [ ] Telegram webhook o'rnatilgan (`getWebhookInfo` da xato yo'q)
- [ ] Menejerlar guruhiga sinov arizasi keldi
- [ ] `docker compose logs backup` — birinchi zaxira olindi va tekshirildi
- [ ] **Zaxiralar serverdan tashqariga nusxalanadi** — bepul serverda bu
      ayniqsa muhim: SLA yo'q, instans ogohlantirmasdan yo'qolishi mumkin
- [ ] Sertifikatni yangilash cron da

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
- [ ] **Dinamik mahsulot sahifasi** yuklama ostida boshqalardan ~5 barobar
      sekin (11.5 RPS / p95 634 ms). Reklama yoki mavsumiy yuklama kutilsa,
      uni ham ISR ga o'tkazish kerak.

---

## Ma'lum cheklovlar (ataylab qabul qilingan)

Bular xato emas, lekin bilib turishingiz kerak:

- **Rate-limit jarayon xotirasida** — `web` bir nechta instansda ishga
  tushsa, amaldagi limit instanslar soniga ko'payadi.
- **Forma tokeni qayta ishlatilishi mumkin** — bir martalik token umumiy
  holat saqlashni (Redis) talab qilardi, u MVP da yo'q.
- **Sessiyani darhol bekor qilib bo'lmaydi** — JWT bazada saqlanmaydi,
  shuning uchun amal muddati 24 soat.

- **Telefonsiz Mini App mijozi kartrij buyurtma qila olmaydi.** Telegram
  avtorizatsiyasi telefon raqamini bermaydi. Bunday mijoz «Almashtirishga
  buyurtma» ni bossa, bot «raqamni ilovada qoldiring» deydi, lekin Mini App da
  bunday forma yo'q — mijoz boshi berk ko'chada qoladi va siz urinish
  bo'lganini bilmaysiz.
  **Amaliy chora:** o'rnatishni CRM da yozayotganda mijoz kartochkasida
  telefon borligiga ishonch hosil qiling. Telefon bo'lsa muammo umuman
  yuzaga kelmaydi.
  Doimiy yechim (botda `request_contact` tugmasi) keyingi bosqichga
  qoldirilgan — `.ralph/fix_plan.md` dagi «Future Enhancements».
