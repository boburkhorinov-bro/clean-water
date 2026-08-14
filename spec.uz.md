# Clean Water — texnik topshiriq v1

[prompt.md](prompt.md) boʻyicha oʻtkazilgan chuqur soʻrov sessiyasi natijasi. Hujjat uch bosqichli suhbatda qabul qilingan qarorlarni qayd etadi va dastlabki gʻoyaga nisbatan nima oʻzgarganini aniq koʻrsatadi.

---

## 1. Nima quramiz

Osmos filtrlar va kartrijlar sotuvi platformasi, almashtirish muddati haqida avtomatik eslatmalar bilan.

**Ikkita interfeys, bitta kod bazasi:**
- **Telegram Mini App** — asosiy kanal. Avtorizatsiya `initData` orqali, mijoz Telegram ID boʻyicha aniqlanadi.
- **Ommaviy sayt** — brauzerdagi oʻsha katalog, qidiruv tizimlari tomonidan indekslanadi. Kirish Telegram Login Widget orqali; arizani kirmasdan ham, telefon raqami boʻyicha qoldirish mumkin.

**Stek:** Next.js (SSR — SEO uchun kerak) + PostgreSQL + Prisma, hammasi Docker ichida.
**Xosting:** Oʻzbekiston (OʻzR fuqarolarining shaxsiy maʼlumotlarini lokalizatsiya qilish talabi).
**Tillar:** oʻzbek (lotin) + rus.
**Toʻlov:** yoʻq. Buyurtma = ariza, menejerga Telegramda xabar keladi.

---

## 2. Birinchi ishga tushirish qamrovi

### MVP tarkibiga kiradi

| Blok | Mazmuni |
|---|---|
| Filtrlar katalogi | Foto, xususiyatlar, narx, video sharh va sharh matni bilan kartochkalar |
| Ariza | «Buyurtma berish» tugmasi → bazaga yozuv + menejerga Telegramda xabar |
| Kartrijlar katalogi | Moslik va resurs koʻrsatilgan sarf materiallari |
| «Mening filtrim» | Shaxsiy ekran: oʻrnatilgan apparat, kartrijlar, qolgan resurs shkalasi, almashtirishga buyurtma tugmasi |
| Avtoeslatmalar | Har bir kartrijning almashtirish muddati yaqinlashganda Telegram xabari |
| Admin panel | Mahsulotlar, tavsif muharriri, arizalar, mijozlar, oʻrnatish va almashtirish belgilari |

### MVP tarkibiga kirmaydi (ikkinchi bosqich)

- Filtr tanlash viktorinasi (kviz)
- Servis markaz («biz haqimizda / xizmatlar / narxlar / shikoyatlar»)
- Mijozlar fikrlari
- Onlayn toʻlov va boʻlib toʻlash

Amalga oshirilmagan bandlar menyuda **koʻrsatilmaydi** — hech qanday «tez orada» degan boʻsh sahifalar yoʻq.

---

## 3. Dastlabki spetsifikatsiyaga nisbatan oʻzgarishlar

Har bir band — eʼtibordan chetda qolgan narsa emas, balki ongli qaror.

| prompt.md da edi | Boʻldi | Nima uchun |
|---|---|---|
| «Platformadan chiqish» tugmasi | Olib tashlandi | Mini App da foydalanuvchi doim Telegram tomonidan aniqlangan, chiqadigan joy yoʻq |
| Taqdimot HTML fayl sifatida yuklanadi | Sanitizatsiya bilan vizual blok muharriri | Ixtiyoriy HTML yuklash — bu XSS teshigi, injection himoyasi talabiga bevosita zid |
| Progress shkalalari «oʻz-oʻzidan toʻladi» | Haqiqiy maʼlumotlarga bogʻlandi | Shkala mijoz kartrijining qolgan resursini va mahsulot kartochkasidagi tozalash bosqichlarini koʻrsatadi. Dekorativ progress buzuqlik sifatida qabul qilinadi |
| «Har 6 oyda» | Har bir kartrij boʻyicha alohida jadval | Mexanika/koʻmir ≈ 6 oy, membrana ≈ 1.5–3 yil, postfiltr ≈ 12 oy. Yagona taymer notoʻgʻri eslatmalar yuborardi |
| «Boʻlib toʻlash» | MVP dan tashqarida, menejer bilan qoʻlda muhokama qilinadi | Haqiqiy boʻlib toʻlash — shartnoma, skoring, pasport maʼlumotlari, Uzum/Alif bilan integratsiya. Alohida yirik bosqich |
| PostgreSQL «yoki» MongoDB | PostgreSQL | Maʼlumotlar qatʼiy relatsion: mijoz → apparat → kartrijlar → almashtirish jadvali |
| Admin panel tumbleri | Tumbler UI da qoladi, rol serverda tekshiriladi | Klientdagi koʻrinuvchanlik — himoya emas. Huquqlar har bir soʻrovda Telegram ID oq roʻyxati boʻyicha tekshiriladi |
| «Mening filtrim» boʻlimi yoʻq edi | MVP ga qoʻshildi | Usiz kartrijlar haqidagi eslatmalar hech qayerga olib bormaydi |
| Oʻz «Tun/Kun» mavzulari | Mavzu Telegramdan olinadi, qoʻlda ham almashtiriladi | Sukut boʻyicha nativlik, brending saqlanadi |

---

## 4. Arxitektura

### 4.1 Joylashtirish topologiyasi

Oʻzbekistondagi bitta VPS. Hammasi `docker compose` orqali koʻtariladi.

```
                     Internet
                        │
                  ┌─────┴──────┐
                  │   nginx    │  TLS (Let's Encrypt), rate-limit,
                  │  :80/:443  │  CSP-sarlavhalar, /media uzatish
                  └─────┬──────┘
             ┌──────────┴──────────┐
             │                     │
       ┌─────┴──────┐        ┌─────┴──────┐
       │    web     │        │   worker   │
       │  Next.js   │        │  bot+cron  │
       │   :3000    │        │            │
       └─────┬──────┘        └─────┬──────┘
             └──────────┬──────────┘
                  ┌─────┴──────┐        ┌──────────────┐
                  │ PostgreSQL │        │ /var/app/    │
                  │   :5432    │        │    media     │
                  └─────┬──────┘        └──────────────┘
                        │
                  cron boʻyicha pg_dump → zaxira nusxalar

Tashqi servislar: Telegram Bot API (chiquvchi + webhook),
                  Kinescope (faqat mijoz brauzeridagi iframe)
```

**Nega `worker` — Next.js ichidagi cron emas, balki alohida konteyner.** Veb-jarayon ichidagi rejalashtiruvchi ikkinchi instans ishga tushganda dublikatlanadi (bitta mijozga ikkita eslatma) va har bir qayta deploy paytida oʻladi. Bot webhooki HTTP soʻrov hayot siklidan mustaqil, barqaror ishlab turuvchi jarayonni talab qiladi.

**Startda ongli ravishda nima yoʻq.** Redis va vazifalar navbati (BullMQ) — yuzlab mijozli yuklamada jadval boʻyicha kunlik cron uddasidan chiqadi, Redis esa administratsiya qilinishi kerak boʻlgan yana bitta nosozlikka moyil komponent qoʻshadi. S3/MinIO — fotolar diskda yotadi, nginx uzatadi. Haqiqiy yuklama paydo boʻlsa, ikkala yechim ham keyinchalik qayta yozishsiz qoʻshiladi.

### 4.2 Ilova qatlamlari

```
marshrutlar (RSC, route handlers)  ← faqat soʻrovni qabul qilish va render
        ↓
      services                     ← barcha biznes-mantiq
        ↓
    repositories (Prisma)          ← maʼlumotlarga kirish
        ↓
     PostgreSQL
```

Qatʼiy qoida: biznes-mantiq React komponentlarida ham, route handler larda ham yashamaydi. `due_at` hisobi, mijoz dublikatlarini birlashtirish, «eslatma yuborish vaqti keldimi» qarori — hammasi `services/` da, chunki bu uchta joydan (veb, Mini App, worker) chaqiriladi va bir xil ishlashi kerak.

### 4.3 Uchta interfeysning ajratilishi

Bitta kod bazasi, uchta marshrut guruhi:

| Guruh | Yoʻl | Rendering | Xususiyatlari |
|---|---|---|---|
| Ommaviy sayt | `/(web)/[locale]/...` | SSR + ISR | SEO, sitemap, hreflang, metama'lumotlar, Open Graph |
| Mini App | `/(miniapp)/app/...` | asosan klient tomonda | Telegramdan mavzu, `initData` boʻyicha avtorizatsiya, indekslanmaydi |
| Admin panel | `/(admin)/admin/...` | SSR | har bir soʻrovda serverda rol tekshiruvi |
| API | `/api/...` | — | arizalar, avtorizatsiya, bot webhooki |

Umumiy boʻlib qoladi: katalog va mahsulot kartochkasi komponentlari, dizayn-tokenlar, `services/`, MB sxemasi. Faqat qobiq, navigatsiya va kirish usuli farq qiladi.

### 4.4 Avtorizatsiya: ikkita kirish, bitta sessiya

```
Mini App:  WebApp.initData
             → POST /api/auth/telegram
             → bot tokeni bilan HMAC-imzoni tekshirish
             → auth_date tekshiruvi (24 soatdan eski emas)
             → telegram_id boʻyicha User upsert
             → JWT httpOnly + Secure + SameSite cookie ga
Brauzer:   Telegram Login Widget
             → oʻsha handler, oʻsha imzo tekshiruvi
             → oʻsha cookie-sessiya
Mehmon:    sessiya yoʻq. Katalog va telefon boʻyicha ariza formasi mavjud.
```

Administrator roli — `User` dagi maydon. Birlamchi adminlar `TELEGRAM_ADMIN_IDS` muhit oʻzgaruvchisi bilan beriladi (bootstrap), keyingilari admin panel orqali beriladi. Har bir admin harakati serverda `requireAdmin()` dan oʻtadi. Interfeysdagi admin panel tumbleri — bu faqat boshqaruv elementlarini koʻrsatish usuli; oʻzi hech qanday huquq bermaydi.

### 4.5 Ariza oqimi

1. Mijoz «Buyurtma berish» ni bosadi → `POST /api/leads`.
2. Sxema boʻyicha validatsiya (zod), IP va Telegram ID boʻyicha rate-limit.
3. Telefonni `+998XXXXXXXXX` koʻrinishiga normallashtirish → mavjud mijozni qidirish → **dublikatlarni birlashtirish**.
4. `Lead(status=new)` yozuvi. **Mijozga javob shu yerda qaytariladi** — muvaffaqiyat Telegramga bogʻliq emas.
5. Menejerlar guruhiga «Ishga olish» inline tugmasi bilan asinxron xabar yuborish, nosozlikda takrorlash bilan.
6. Menejer statusni admin panelda yuritadi: `new → in_work → done | rejected`.

Eng muhimi: Telegram API ning ishlamay qolishi arizani yoʻqotmasligi kerak. Avval baza, keyin xabar.

### 4.6 Almashtirish eslatmalari oqimi

Har kuni Toshkent vaqti bilan 09:00 da worker:

1. `replaced_at IS NULL` boʻlgan va `due_at` gacha 30, 7 yoki 0 kun qolgan `InstalledPart` larni tanlaydi.
2. Bu turdagi eslatma hali yuborilmaganini tekshiradi — `(installed_part_id, kind)` unikal indeksi buni mantiq darajasida emas, MB darajasida kafolatlaydi.
3. «Almashtirishga buyurtma» tugmasi bilan xabar yuboradi (katalogdan oʻtmasdan, darhol ariza yaratadi).
4. `sent_at` ni yozadi. Telegramdan `429` xatosi kelganda — `retry_after` ni hurmat qiladi va keyingi oʻtishga koʻchiradi.

Idempotentlik bu yerda ixtiyoriy emas: bitta kartrij haqidagi takroriy eslatma mijoz tomonidan spam sifatida oʻqiladi va oʻtkazib yuborilgan eslatmadan qimmatroqqa tushadi.

### 4.7 Lokalizatsiya

Ommaviy sayt: tillar yoʻlda — `/uz/...` va `/ru/...`. Indekslash uchun alohida URL lar kerak, shuning uchun manzilni oʻzgartirmasdan til almashtirish toʻgʻri kelmaydi. `hreflang` va kanonik havolalar qoʻyiladi.

Mini App: til `initData.user.language_code` dan olinadi, qoʻlda almashtiriladi va profilda eslab qolinadi.

Mahsulot kontenti ikkala tilni bitta yozuvda saqlaydi (`name_uz` / `name_ru`, til kalitlari bilan tavsif bloklari). Yetishmayotgan tarjima boʻshliq koʻrsatmaydi, balki oʻzbek tiliga tushadi.

### 4.8 HTML yuklash oʻrniga kontent-bloklar

`Product.content_blocks` — jsonb dagi tiplashtirilgan obyektlar massivi:

```json
[
  { "type": "heading",   "uz": "...", "ru": "..." },
  { "type": "paragraph", "uz": "...", "ru": "..." },
  { "type": "image",     "src": "/media/...", "alt": {...} },
  { "type": "specs",     "rows": [{ "k": {...}, "v": {...} }] },
  { "type": "video",     "provider": "kinescope", "id": "..." }
]
```

Renderer `type` ni React komponenti bilan solishtiradi. `dangerouslySetInnerHTML` hech qayerda ishlatilmaydi. Agar keyinchalik formatlash bilan erkin matn kerak boʻlsa, u chiqarishda emas, **saqlashda** teglarning oq roʻyxati bilan `sanitize-html` dan oʻtadi.

Bu «HTML-taqdimot injectiondan himoyaga qarshi» ziddiyatining texnik yechimi: verstka erkinligi bloklar toʻplami bilan cheklanadi, buning evaziga hujum yuzasi nolga teng, sahifalar esa bir xil koʻrinishda boʻladi.

### 4.9 Loyiha tuzilmasi

```
src/
  app/
    (web)/[locale]/          ommaviy katalog, SEO-sahifalar
    (miniapp)/app/           Telegram Mini App
    (admin)/admin/           admin panel va CRM
    api/
      auth/telegram/         imzo tekshiruvi, sessiya berish
      leads/                 arizalarni qabul qilish
      telegram/webhook/      botning kiruvchi update lari
  server/
    services/                biznes-mantiq (arizalar, kartrij resursi,
                             eslatmalar, mijozlarni birlashtirish)
    repositories/            Prisma orqali maʼlumotlarga kirish
    auth/                    sessiyalar, initData tekshiruvi, rollar
  components/
    ui/                      dizayn-tizim, mavzular
    catalog/                 umumiy mahsulot kartochkalari
    content/                 kontent-bloklar rendereri
  lib/                       i18n, validatsiya, yordamchi funksiyalar
worker/
  bot/                       buyruq va tugmalar handlerlari
  jobs/                      eslatmalarning kunlik rejalashtiruvchisi
prisma/
  schema.prisma
  migrations/
```

### 4.10 Asosiy qarorlar va ularning narxi

| Qaror | Muqobil | Nima uchun shunday |
|---|---|---|
| SSR bilan Next.js | SPA + alohida API | Ommaviy katalog indekslanishi kerak; SPA buni alohida rendersiz bermaydi |
| Uchta interfeysga bitta kod bazasi | Sayt, Mini App va admin panel uchun alohida loyihalar | Katalog, maʼlumotlar modeli va mantiq umumiy; uchta repozitoriy uch karra sinxronizatsiya degani |
| Worker alohida konteyner | Next.js ichidagi cron | Eslatmalar dublikatlanishi va qayta deployda rejalashtiruvchining oʻlishidan qochamiz |
| Jadval boʻyicha cron | Redis bilan vazifalar navbati | Startda yuklama kichik, Redis esa administratsiya uchun ortiqcha komponent |
| Diskdagi fayllar + nginx | S3 / MinIO | Xosting lokal, media hajmi katta emas, zaxira nusxa server bilan birga olinadi |
| Kontent-bloklar uchun jsonb | Bloklar uchun alohida jadvallar | Bloklar doim yaxlit oʻqiladi va hech qachon alohida tanlanmaydi |
| httpOnly cookie dagi JWT | MB dagi sessiyalar | Har bir soʻrovda MB ga murojaatni talab qilmaydi; bekor qilish qisqa amal muddati bilan hal qilinadi |

---

## 5. Maʼlumotlar modeli (qoralama)

```
User            telegram_id, phone, name, lang, role, created_at
Product         kind(filter|cartridge), slug, name_uz, name_ru,
                content_blocks(jsonb), price, images, video_id, is_active
CartridgeSpec   product_id, resource_months
Compatibility   cartridge_id ↔ filter_id
Lead            user_id | phone, product_id, source(miniapp|web),
                status(new|in_work|done|rejected), comment, created_at
Installation    user_id, filter_product_id, installed_at, address, note
InstalledPart   installation_id, cartridge_product_id,
                installed_at, due_at, replaced_at
Notification    installed_part_id, scheduled_at, sent_at, status
AuditLog        admin_id, action, entity, payload, created_at
```

Asosiy natijalar:
- Bitta mijoz **bir nechta** oʻrnatishga ega boʻlishi mumkin (uy, dala hovli) — model buni qoʻllab-quvvatlaydi.
- Mijoz ikki marta kelishi mumkin: Telegramdan va saytdan telefon boʻyicha. Raqam boʻyicha **dublikatlarni birlashtirish** kerak.
- `due_at` buyurtma sanasidan emas, aniq kartrijning `installed_at` + `resource_months` idan hisoblanadi.

---

## 6. Xavfsizlik talablari

Dastlabki «injection va boshqa hujumlardan himoya» talabi quyidagicha ochib beriladi:

- Har bir soʻrovda serverda Telegram `initData` ning HMAC-imzosini tekshirish.
- Rollar serverda tekshiriladi; klientdagi admin bayrogʻi hech narsani hal qilmaydi.
- MB ga barcha soʻrovlar Prisma orqali (parametrlashtirilgan), kiruvchi maʼlumotlar sxemalar bilan validatsiya qilinadi (zod).
- Tavsiflarning HTML i tizim tomonidan bloklardan generatsiya qilinadi va sanitizatsiyadan oʻtadi — ixtiyoriy HTML qabul qilinmaydi.
- Ariza va fikr formalarida rate-limit, ommaviy formada spam-botlardan himoya.
- CSP-sarlavhalar, HTTPS majburiy, sirlar faqat muhit oʻzgaruvchilarida.
- Administratorlar harakatlari jurnali (`AuditLog`).
- MB ning avtomatik zaxira nusxalari, tiklashni tekshirish bilan.

---

## 7. Kritik yoʻl

Tartib muhim: 0 va 1-bandlar ishlab chiqish bilan **parallel** bajariladi va koʻpincha muddat buzilishining sababi boʻladi.

0. **Infratuzilma (egasining zimmasida).** YaTT yoki yuridik shaxs → domen → Oʻzbekistonda VPS → Docker + PostgreSQL + zaxira nusxalar.
1. **Kontent (egasining zimmasida).** Kamida 3–5 model filtr: foto, xususiyatlar, narx, ikki tilda tavsif. Kartrijlar roʻyxati, oylardagi resursi bilan. Video sharhlar.
2. **Riskni tekshirish.** Kinescope pleyerining prototipi haqiqiy iOS va Androiddagi Telegram WebView ichida. Barcha videolarni yuklashdan **oldin** qilinadi — agar toʻliq ekran rejimi ishlamasa, video boʻyicha reja oʻzgaradi.
3. Skelet: Next.js + Prisma + PostgreSQL, avtorizatsiya (initData + Login Widget), i18n uz/ru.
4. Katalog, mahsulot kartochkasi, ariza, menejerga xabar.
5. Admin panel: mahsulotlar, blok muharriri, arizalarni qayta ishlash.
6. CRM: mijozlar, oʻrnatishlar, kartrijlar, sanalarni belgilash.
7. Eslatmalar rejalashtiruvchisi + resurs shkalalari bilan «Mening filtrim» ekrani.
8. Dashboard, banner, dizayn, tungi va kunduzgi mavzular.
9. Hardening, zaxira nusxalar, yuklama sinovi, ishga tushirish.

---

## 8. Ochiq savollar

Detallashtirishni bloklaydi, lekin ishlab chiqishni boshlashga toʻsqinlik qilmaydi.

1. **«Biz mijozlar»** — bu qanday boʻlim: «biz haqimizda», mijozlar fikrlari, oʻrnatishlar galereyasi?
2. **«Mahsulotlarini almashtirish»** — qanday funksiya nazarda tutilgan?
3. **Servis markaz**: jadvaldagi «havola» ustuni qayerga olib boradi? Nega «biz haqimizda» va «narxlar» qidiruvli jadval koʻrinishida?
4. **Fikrlar**: ommaviymi yoki faqat egasi uchunmi? Nashrdan oldin moderatsiya boʻladimi?
5. **Kinescope**: akkaunt toʻlanganmi? Nechta video suratga olingan?
6. **Kontent hajmi**: startda nechta model filtr va kartrij boʻladi?
7. **Muddatlar va ijrochilar**: dedlayn, byudjet, ishlab chiqishni kim olib boradi.
8. **Tanlash viktorinasi** (2-bosqich): qaysi parametrlar boʻyicha va ekspert mantiqni kim beradi?
