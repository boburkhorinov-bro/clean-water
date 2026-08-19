# Loyiha egasi bajaradigan ishlar

Kod tayyor: kritik yo'l (TZ §3–§9) yopilgan, 688 test o'tadi (418 birlik +
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
- [ ] Migratsiyalar qo'llangan — `docker compose logs migrate` da xato yo'q
      (ular `up` da avtomatik ishlaydi, `web` ularni kutadi)
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
- [x] ~~**Dinamik mahsulot sahifasi** yuklama ostida ~5 barobar sekin~~ —
      hal qilindi (2026-08-19): mahsulot sahifalari ham ISR ga o'tkazildi
      (`revalidate = 60`, ro'yxatlar bilan bir xil). Admin panelda
      tahrirlangan mahsulot bir daqiqagacha eski ko'rinishi mumkin.

---

## Ma'lum cheklovlar (ataylab qabul qilingan)

Bular xato emas, lekin bilib turishingiz kerak:

- **Rate-limit jarayon xotirasida** — `web` bir nechta instansda ishga
  tushsa, amaldagi limit instanslar soniga ko'payadi.
- **Forma tokeni qayta ishlatilishi mumkin** — bir martalik token umumiy
  holat saqlashni (Redis) talab qilardi, u MVP da yo'q.
- **Sessiyani darhol bekor qilib bo'lmaydi** — JWT bazada saqlanmaydi,
  shuning uchun amal muddati 24 soat.
