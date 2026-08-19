# Clean Water — nol byudjet bilan ishga tushirish

> **HOLAT (2026-08-20): bu variant tanlanmadi.** Egasi Vercel + Render + Neon
> yo'lini tanladi — [DEPLOY-PAAS.md](DEPLOY-PAAS.md). Pastdagi tahlil kuchda
> qoladi va Docker/VPS ga qaytish kerak bo'lsa ishlatiladi; xususan Vercel
> Hobby haqidagi ogohlantirish ham o'z kuchida (u yerda tijoriy foydalanish
> shartlarda taqiqlangan).

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

## Amaliy qadamlar: Oracle + DuckDNS

Bu bo'lim [DEPLOY.md](DEPLOY.md) dan **oldin** bajariladigan ishlarni
tavsiflaydi: u yerda «Ubuntu li VPS tayyor» deb boshlanadi, mana shu bo'lim
o'sha VPS ni bepul qilib beradi. Oxirida siz DEPLOY.md §2 ga o'tasiz.

**Tartib muhim:** subdomen → instans → portlar → DNS → Docker → DEPLOY.md.

### 1. DuckDNS subdomeni (~5 daqiqa, kartasiz)

1. [duckdns.org](https://www.duckdns.org) → GitHub/Google bilan kiring.
2. Nom tanlang (masalan `cleanwater`) → `cleanwater.duckdns.org` beriladi.
3. **Tokenni saqlang** — u IP ni yangilash uchun kerak.

IP ni hozir kiritmang: instans hali yo'q. Bu 4-qadamda qilinadi.

### 2. Oracle instansi

Shape: **Ampere A1 (`VM.Standard.A1.Flex`)**, `x86` emas — bepul limit
faqat ARM da mo'l. Darhol **2 OCPU / 12 GB** doirasida qoling: 2026-yil
iyunidan keyin undan yuqorisi bepul emas va instans o'chirilishi mumkin.

Obraz: **Ubuntu 24.04 (aarch64)**.

SSH kaliti: yaratishda **ochiq kalitni yuklang** — Oracle parol bilan kirishni
yoqmaydi. Kalit bo'lmasa avval yarating:

```bash
ssh-keygen -t ed25519 -C "cleanwater"
cat ~/.ssh/id_ed25519.pub   # shuni Oracle ga joylashtiring
```

**Kutilgan to'siq: «Out of host capacity».** Bepul ARM quvvati ko'p
regionlarda band va bu xato oddiy hol — hisobingizda muammo yo'q. Chorasi:
boshqa availability domain ni sinang, yoki bir necha soatdan keyin qayta
uring. Region ni **birinchi tanlashda** o'zingizga yaqinini oling: u keyin
o'zgarmaydi.

### 3. Portlarni ochish — IKKI joyda

Bu Oracle ning eng ko'p vaqt yeydigan tuzog'i: 80/443 **ikki qatlamda**
yopiq turadi va faqat bittasini ochish yetarli emas. Sayt «ochilmayapti»
deyilganda sabab deyarli har doim shu.

**a) VCN Security List** (Oracle konsolida): instans → VCN → Security List →
Ingress Rules ga ikkita qoida qo'shing — `0.0.0.0/0`, TCP, portlar `80` va
`443`.

**b) Instansning o'zidagi iptables**: Oracle ning Ubuntu obrazi standart
holatda faqat 22-portni o'tkazadi.

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

`netfilter-persistent save` ni **o'tkazib yubormang** — usiz qoidalar
serverni qayta yuklaganda yo'qoladi va sayt sababsiz «o'chib qoladi».

### 4. DuckDNS ni instans IP siga qaratish

Oracle bergan public IP ni DuckDNS panelidagi maydonga yozing va `update`
bosing. Tekshirish:

```bash
nslookup cleanwater.duckdns.org   # instans IP sini qaytarishi kerak
```

DNS tarqalishini kuting — DuckDNS da bu odatda bir necha daqiqa. **TLS ga
shu tekshiruvdan oldin o'tmang**: Let's Encrypt domenni HTTP orqali
tekshiradi va DNS hali eski bo'lsa sertifikat berilmaydi, ko'p urinish esa
soatlik limitga tushiradi.

### 5. Docker

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
```

`usermod` dan keyin **SSH sessiyasini yopib qaytadan kiring** — aks holda
guruh a'zoligi kuchga kirmaydi va har `docker` buyrug'i `sudo` talab qiladi.

Tekshirish: `docker run --rm hello-world`.

### 6. Keyin — DEPLOY.md

Shu paytdan boshlab hamma narsa [DEPLOY.md](DEPLOY.md) §2 bo'yicha ketadi.
Bitta farq: `.env` da

```
NEXT_PUBLIC_SITE_URL="https://cleanwater.duckdns.org"
```

va bu qiymat **obrazni qurishdan oldin** turishi shart (DEPLOY.md §2).

Build ni serverda qilish: 12 GB da Next.js build sig'adi, lekin u ~1.5 GB
yeydi va ARM da sekinroq ketadi. Birinchi build uchun sabr qiling.

## Nimani hisobga olish kerak

- **SLA yo'q.** Oracle bepul instansni ogohlantirmasdan o'chirishi mumkin.
  Zaxiralar (`scripts/backup.sh`) VM dan **tashqariga** ko'chirilishi shart —
  aks holda instans yo'qolsa ma'lumot ham yo'qoladi.
- **Bepul limitlar o'zgaradi.** 2026-yil iyunidagi qisqartirish shuni
  ko'rsatdi. Docker Compose ga tayangani uchun boshqa VM ga ko'chish oson.
- **Ro'yxatdan o'tishda karta talab qilinadi** — shaxsni tasdiqlash uchun,
  pul yechilmaydi.
