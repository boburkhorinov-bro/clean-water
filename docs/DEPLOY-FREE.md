# Clean Water — nol byudjet bilan ishga tushirish

Bu hujjat [DEPLOY.md](DEPLOY.md) ni almashtirmaydi — u **qayerga** qo'yishni
tanlashga yordam beradi. Texnik tartib o'sha-o'sha: `docker compose up -d`.

Holat 2026-08-16 ga tekshirilgan. Bepul rejalar tez o'zgaradi — pastdagi
raqamlarni tanlash oldidan qayta tekshiring.

## Arxitektura nimani talab qiladi

Bu stekni «serverless» ga qo'yib bo'lmaydi, sababi ikkita:

1. **`worker` uzluksiz ishlaydi.** Har kuni 09:00 (Toshkent) da eslatmalar
   yuboriladi (§4.6). Bekor turganda «uxlab qoladigan» bepul rejalar buni
   buzadi: konteyner o'chgan bo'lsa, o'sha kungi eslatma yuborilmaydi.
2. **`/media/` doimiy diskda.** Mahsulot rasmlari fayl sifatida saqlanadi va
   nginx uzatadi (§4.1). Har deployda tozalanadigan disk ularni yo'qotadi.

Ya'ni kerak bo'ladigan narsa — **doimiy ishlaydigan virtual mashina**, PaaS emas.

## Variantlar

| Variant | Tijoriy foydalanish | Uxlaydimi | Xulosa |
|---|---|---|---|
| **Oracle Cloud Always Free** | ruxsat, aniq taqiq yo'q | yo'q | **Tavsiya etiladi** |
| Vercel Hobby | **TAQIQLANGAN** | — | Yaramaydi |
| Render Free | ruxsat | **ha**, bekorchilikdan keyin | Worker ni buzadi |
| Neon / Supabase (faqat baza) | ruxsat | Supabase 7 kundan keyin **pauza** | Faqat baza, VM kerak baribir |
| Google Cloud e2-micro | ruxsat | yo'q | 1 GB RAM — stek sig'maydi |

**Vercel Hobby alohida ta'kid.** Uning shartlarida tijoriy foydalanish ochiq
taqiqlangan, va «tijoriy» keng talqin qilinadi: mahsulot yoki xizmat reklama
qilinishi ham, saytni yaratganga haq to'langani ham shunga kiradi. Filtr
sotadigan platforma bu ta'rifga to'liq tushadi.

## Tavsiya: Oracle Cloud Always Free

Mavjud `docker-compose.yml` **o'zgarishsiz** ishlaydi.

- 2 OCPU / 12 GB RAM (ARM Ampere), 200 GB disk
- Muddati tugamaydi
- SLA **yo'q** — bu bepulning haqiqiy narxi

### Diqqat: 2026-yil iyunidagi qisqartirish

Oracle 2026-yil 15-iyunda Always Free ARM limitini **4 OCPU / 24 GB dan
2 OCPU / 12 GB ga tushirdi**, va yangi limitdan oshib turgan instanslar
**2026-yil 18-avgustdan** o'chirila boshlaydi. Yangi instans yaratayotganda
darhol 2/12 doirasida qoling.

12 GB bu stek uchun mo'l: postgres + web + worker + nginx + backup.

### ARM mosligi — tekshirildi

Bepul Oracle serveri `aarch64`, shuning uchun bu alohida tekshirildi:

| Komponent | Holat |
|---|---|
| `node:24-alpine` | multi-arch, arm64 bor |
| `postgres:17-alpine` | multi-arch, arm64 bor |
| `nginx:1.29-alpine` | multi-arch, arm64 bor |
| Prisma 7 klienti | **native binar yo'q** |

Oxirgi qator eng muhimi. Prisma odatda platformaga bog'langan query engine
binarini talab qiladi va ARM da `binaryTargets` ni qo'lda ko'rsatmasa deploy
yiqiladi. Bu loyihada bunday muammo **yo'q**: Prisma 7 driver adapteri
(`PrismaPg`) bilan ishlaydi va generatsiya qilingan klientda bitta ham
`.node`/`.wasm` fayl yo'q — `src/generated/prisma/` da tekshirilgan.

## Bepul qolgan qismlar

| Nima | Xizmat | Bepul chegara |
|---|---|---|
| Baza | PostgreSQL o'sha VM da | disk hajmi bilan chegaralangan |
| TLS | Let's Encrypt | cheksiz, 90 kunda yangilanadi |
| Telegram bot va Mini App | Telegram Bot API | bepul |
| Video | Kinescope Free | 100 daqiqa saqlash, 200 GB/oy trafik |
| Zaxira | `pg_dump` o'sha VM da | — |

Kinescope ning bepul rejasi kartochkasiz va muddatsiz. 3–5 mahsulot obzori
uchun 100 daqiqa yetarli. U stekdagi **yagona** tashqi servis (§4.1) va
CSP `frame-src` da qattiq belgilangan — boshqa provayderga o'tish sxema
o'zgarishini talab qiladi.

## Yagona muqarrar xarajat: domen

Domen bepul emas. Ikki yo'l:

1. **O'z domeningiz** (`.uz` yoki `.com`) — yiliga ~10–15 $. Biznes uchun
   to'g'ri tanlov.
2. **Bepul subdomen** (DuckDNS va shunga o'xshashlar) — 0 $. Let's Encrypt
   ular uchun ham sertifikat beradi, Telegram Mini App ham ishlaydi.
   Kamchiligi: `cleanwater.duckdns.org` ko'rinishi mijozda ishonch
   uyg'otmaydi.

Ikkinchi yo'l bilan boshlab, keyin domenga o'tish mumkin — lekin
**`NEXT_PUBLIC_SITE_URL` o'zgargani uchun obrazni qayta qurish shart**
([DEPLOY.md §2](DEPLOY.md) ga qarang), va eski manzilga qo'yilgan qidiruv
indeksini ko'chirish kerak bo'ladi.

## Nimani hisobga olish kerak

- **SLA yo'q.** Oracle bepul instansni ogohlantirmasdan o'chirishi mumkin.
  Zaxiralar (`scripts/backup.sh`) VM dan **tashqariga** ko'chirilishi shart —
  aks holda instans yo'qolsa ma'lumot ham yo'qoladi.
- **Bepul limitlar o'zgaradi.** 2026-yil iyunidagi qisqartirish shuni
  ko'rsatdi. Docker Compose ga tayangani uchun boshqa VM ga ko'chish oson.
- **Ro'yxatdan o'tishda karta talab qilinadi** — shaxsni tasdiqlash uchun,
  pul yechilmaydi.
