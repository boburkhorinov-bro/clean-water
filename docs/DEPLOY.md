# Clean Water — deploy va relizga tayyorlik

Bu hujjat ishlab chiqarish serveriga birinchi marta chiqish va keyingi
yangilanishlar tartibini tavsiflaydi (TZ §7).

**Diqqat:** `docker compose` bu loyihada hech qachon ishlab chiqarish
sharoitida sinalmagan — ishlab chiqish mashinasida Docker ko'tarilmaydi
(3.8 GB xotira). Birinchi ishga tushirish serverda bo'ladi va quyidagi
qadamlarni **birma-bir**, har birining natijasini tekshirib bajaring.

---

## 1. Talablar

- Ubuntu/Debian li VPS, kamida 2 GB RAM (Next.js build 1.5 GB gacha yeydi;
  build ni serverda emas, CI da qilish afzal).
- Docker Engine + Docker Compose plugin.
- A-yozuvi serverga qaratilgan domen.
- 80 va 443 portlari ochiq (Let's Encrypt HTTP tekshiruvi 80 ni talab qiladi).

Server hali tanlanmagan bo'lsa — [DEPLOY-FREE.md](DEPLOY-FREE.md): nol byudjet
bilan qaysi variant bu arxitekturaga mos kelishi va nega ko'pchiligi
kelmasligi.

## 2. Sozlash

```bash
git clone <repo> /opt/cleanwater
cd /opt/cleanwater
cp env.example .env
```

`.env` ni to'ldiring. **Prodda bo'sh yoki namuna qiymati bilan ilova
ko'tarilmaydi** — `src/server/env.ts` startda tekshiradi:

| O'zgaruvchi | Izoh |
|---|---|
| `DATABASE_URL` | `postgresql://cleanwater:<parol>@postgres:5432/cleanwater?schema=public` — host `postgres`, `localhost` emas |
| `POSTGRES_PASSWORD` | `DATABASE_URL` dagi parol bilan bir xil |
| `JWT_SECRET` | `openssl rand -base64 48`. Kamida 32 belgi |
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan token |
| `TELEGRAM_MANAGER_CHAT_ID` | Arizalar tushadigan guruh — ID **manfiy** (pastga qarang) |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32`. Bo'sh bo'lsa webhook hamma so'rovni 401 qiladi |
| `TELEGRAM_ADMIN_IDS` | Bootstrap adminlar, vergul bilan |
| `NEXT_PUBLIC_SITE_URL` | `https://<domen>` — **prodda HTTPS shart, va u QURISHDAN OLDIN kerak** (pastga qarang) |

### `TELEGRAM_MANAGER_CHAT_ID` — guruh, shaxsiy chat emas

Guruh ID si har doim **manfiy** (`-100...` yoki `-...`). Musbat son — bu
shaxsiy chat, va oqibati ikki xil bo'ladi: arizani faqat bitta odam ko'radi,
«Ishga olish» tugmasi jamoaviy ishlamaydi; agar o'sha odam botga hech qachon
`/start` yozmagan bo'lsa, Telegram `403` qaytaradi va xabar umuman ketmaydi
(ariza baribir bazada qoladi — u avval yoziladi, xabar keyin).

ID ni olish: guruhga @getidsbot ni qo'shing → u ID ni yozadi → botni
chiqaring. **Bot guruhda administrator bo'lishi shart**, aks holda xabar
yubora olmaydi.

### `NEXT_PUBLIC_SITE_URL` — obrazni qurishdan oldin

`NEXT_PUBLIC_*` bilan boshlanadigan har qanday o'zgaruvchini Next.js **qurish
paytida** kodga muhrlaydi. Ya'ni uni `docker compose` ning `environment:`
qismida berish **kech**: obraz o'shanda allaqachon qurilgan bo'ladi.

Domen `.env` da noto'g'ri bo'lsa nima bo'lardi: ilova normal ko'tariladi,
barcha sahifalar 200 qaytaradi, smoke-test o'tadi — lekin har bir `canonical`,
`hreflang`, `robots.txt` va `sitemap.xml` `http://localhost:3000` ga ishora
qiladi. Buni faqat qidiruv tizimi indeksni buzganda sezish mumkin (§4.7).

Shuning uchun `Dockerfile` build bosqichida to'xtaydi, agar qiymat `https://`
bilan boshlanmasa. Amaliy oqibati:

```bash
# .env da NEXT_PUBLIC_SITE_URL="https://<domen>" TO'LDIRILGAN bo'lishi kerak,
# ANDIN keyin qurish. docker compose uni build-arg sifatida o'zi uzatadi.
docker compose build web
```

**Domen o'zgarsa obrazni qayta qurish shart** — konteynerni qayta ishga
tushirish yetarli emas.

Ixtiyoriy:

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `DATABASE_POOL_MAX` | 10 | Bitta jarayonning ulanishlar hovuzi (pastga qarang) |
| `BACKUP_HOUR` | 03 | Kunlik zaxira vaqti |
| `BACKUP_RETENTION_DAYS` | 14 | Zaxiralarni saqlash muddati |

## 3. Birinchi ishga tushirish (HTTP)

TLS hali yo'q — avval sayt HTTP da ko'tariladi, sertifikat esa shundan keyin
olinadi (Let's Encrypt domenni tekshirishi uchun sayt allaqachon javob
berayotgan bo'lishi kerak).

```bash
docker compose up -d --build
docker compose exec web npx prisma migrate deploy
docker compose exec web npm run db:seed      # ixtiyoriy: demo katalog
docker compose ps                            # hammasi `healthy` bo'lsin
sh scripts/smoke.sh http://<domen>
```

## 4. TLS yoqish

```bash
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v cleanwater_certbot-webroot:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d <domen> -d www.<domen> --email <pochta> --agree-tos --no-eff-email
```

Sertifikat olingach TLS konfiguratsiyasiga o'ting:

```bash
cd docker/nginx/conf.d
sed -i 's/example\.uz/<domen>/g' tls.conf.disabled
mv default.conf default.conf.disabled
mv tls.conf.disabled tls.conf
cd -
docker compose exec nginx nginx -t          # sintaksis
docker compose exec nginx nginx -s reload
sh scripts/smoke.sh https://<domen>
```

Ikkala konfiguratsiya bir vaqtda yuklanmaydi: har ikkisida ham `listen 80`
bor va ikkinchisi birinchisini soya qilib qo'yardi.

Sertifikatni yangilash (cron, oyiga bir marta yetarli):

```bash
0 4 1 * * cd /opt/cleanwater && docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v cleanwater_certbot-webroot:/var/www/certbot \
  certbot/certbot renew --webroot -w /var/www/certbot --quiet \
  && docker compose exec -T nginx nginx -s reload
```

`/.well-known/acme-challenge/` yo'li HTTPS redirectdan mustasno —
`tls.conf` da shu uchun qoldirilgan. Uni olib tashlash 90 kundan keyin
saytni sertifikatsiz qoldiradi.

## 5. Telegram webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<domen>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["callback_query"]'
```

Tekshirish: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` —
`pending_update_count` o'smasligi kerak.

## 5.1. Mini App ni BotFather da ro'yxatdan o'tkazish

Webhook ulangani Mini App ni ochmaydi — bu ikki xil narsa. Telegram
mijozga ilovani ko'rsatishi uchun bot sozlamalarida manzil qayd etilishi
kerak, aks holda `.env` to'g'ri bo'lsa ham mijozda ochiladigan hech narsa
bo'lmaydi.

@BotFather da:

```
/mybots -> <bot> -> Bot Settings -> Menu Button -> Configure menu button
manzil: https://<domen>/app
matn  : Mening filtrim
```

Yoki alohida Mini App sifatida: `/newapp` -> botni tanlang -> nom, tavsif,
ikonka (640x360) -> Web App URL: `https://<domen>/app`.

Tekshirish: Telegramda botni oching, pastdagi menyu tugmasi bosilganda
ilova ochilishi va katalog ko'rinishi kerak.

**HTTPS shart.** Telegram Mini App ni faqat haqiqiy sertifikat bilan
ochadi — o'z-o'zini imzolagan sertifikat ishlamaydi. Shuning uchun bu qadam
§4 (TLS) dan KEYIN bajariladi.

## 6. Zaxira

`backup` konteyneri har kuni `BACKUP_HOUR` da:

1. `pg_dump --format=custom` bilan `./backups/cleanwater-<sana>-<vaqt>.dump`;
2. dump ni **vaqtinchalik bazaga tiklab ko'radi** va jadvallardagi qatorlarni
   sanaydi;
3. `BACKUP_RETENTION_DAYS` dan eski fayllarni o'chiradi.

Tekshirish:

```bash
docker compose logs backup --tail 50
ls -lh backups/
```

Qo'lda zaxira va tekshiruv:

```bash
docker compose exec backup sh /scripts/backup.sh
docker compose exec backup sh /scripts/verify-restore.sh
```

**Tiklash** (buzuvchi amal — mavjud jadvallar tashlanadi):

```bash
docker compose stop web worker
docker compose exec backup sh /scripts/restore.sh /backups/<fayl>.dump --yes
docker compose start web worker
```

`--yes` siz skript ishlamaydi. Tiklashni sinab ko'rmoqchi bo'lsangiz
`restore.sh` emas, `verify-restore.sh` dan foydalaning: u ishchi bazaga
umuman tegmaydi.

**Zaxiralarni serverdan tashqariga olib chiqing.** `./backups/` shu diskda
turadi va disk yo'qolsa zaxira ham yo'qoladi. Eng oddiy yo'l — `rsync`
bilan boshqa mashinaga kunlik nusxa.

`verify-restore.sh` bazada `CREATEDB` huquqini talab qiladi. Docker dagi
`POSTGRES_USER` superuser bo'lgani uchun bu shart bajarilgan.

## 7. Ulanishlar limiti

Har bir `web`/`worker` jarayoni o'z hovuzini ochadi:

```
max_connections >= (web instanslari + worker) × DATABASE_POOL_MAX + zaxira
```

Standart holatda: (1 + 1) × 10 + zaxira = ~25, PostgreSQL ning standart
`max_connections=100` ga bemalol sig'adi. Agar `postgres` xizmatiga
`max_connections` pasaytirilgan bo'lsa, `DATABASE_POOL_MAX` ni ham
pasaytiring — aks holda sahifalar «Too many database connections opened»
bilan 500 qaytaradi.

## 8. Yangilash

```bash
cd /opt/cleanwater
git pull
docker compose up -d --build
docker compose exec web npx prisma migrate deploy
sh scripts/smoke.sh https://<domen>
```

Migratsiyalar oldinga mos: eski `web` yangi sxema bilan bir muddat ishlay
oladi. Buzuvchi migratsiya (ustunni o'chirish, nomini o'zgartirish) kerak
bo'lsa, avval zaxira oling.

## 9. Yuklama tekshiruvi

```bash
node scripts/loadtest.mjs https://<domen>/uz -c 20 -d 30
node scripts/loadtest.mjs https://<domen>/uz/filtrlar/<slug> -c 10 -d 20
```

Ishlab chiqish mashinasidagi o'lchov (3.8 GB RAM, mijoz va server bir
mashinada, `node .next/standalone/server.js`) — ular server imkoniyatining
yuqori chegarasi emas, faqat tartib ko'rsatkichi:

| Yo'l | Parallel | RPS | p50 | p95 |
|---|---|---|---|---|
| `/uz` (SSG) | 10 | 66 | 137 ms | 253 ms |
| `/uz/filtrlar` (ISR) | 10 | 70 | 134 ms | 239 ms |
| `/uz/filtrlar/<slug>` (dinamik, bazaga boradi) | 5 | 11.5 | 248 ms | 634 ms |
| `/api/health` | 20 | 144 | 134 ms | 217 ms |

Dinamik sahifa qolganlaridan besh baravar sekin — u har so'rovda bazaga
boradi. Yuklama kutilsa, mahsulot sahifasini ham ISR ga o'tkazish kerak
bo'ladi.

## 10. Relizga tayyorlik cheklisti

- [ ] `.env` to'ldirilgan, sirlar generatsiya qilingan (namuna qiymati yo'q)
- [ ] `docker compose ps` — barcha xizmatlar `healthy`
- [ ] Migratsiyalar qo'llangan (`prisma migrate deploy`)
- [ ] TLS ishlaydi, HTTP → HTTPS yo'naltiriladi, HSTS sarlavhasi bor
- [ ] `sh scripts/smoke.sh https://<domen>` — hammasi joyida
- [ ] Telegram webhook o'rnatilgan (`getWebhookInfo` da xato yo'q)
- [ ] Mini App BotFather da ro'yxatdan o'tkazilgan (menyu tugmasi ilovani ochadi)
- [ ] Menejerlar guruhiga sinov arizasi keldi
- [ ] `docker compose logs backup` — birinchi zaxira olindi va tekshirildi
- [ ] Zaxiralar serverdan tashqariga nusxalanadi
- [ ] Sertifikatni yangilash cron da
- [ ] Katalogda haqiqiy mahsulotlar bor (demo seed emas)
- [ ] Kinescope videosi haqiqiy iOS va Android da, Telegram WebView ichida
      sinab ko'rilgan (§9 dagi ochiq risk)

## 10.1. Ma'lum cheklovlar

- **Rate-limit jarayon xotirasida** (`src/server/rate-limit.ts`). `web` bir
  nechta instansda ishga tushsa, amaldagi limit instanslar soniga ko'payadi.
  nginx darajasidagi `limit_req` ikkinchi qatlam bo'lib qoladi.
- **Forma tokeni qayta ishlatilishi mumkin.** U holat saqlamaydi, ya'ni bir
  marta olingan token amal muddati ichida bir necha ariza uchun ishlatilishi
  mumkin. Buni rate-limit cheklaydi (IP bo'yicha soatiga 10 ta, nginx da
  daqiqasiga 5 ta). Bir martalik tokenlar umumiy holat saqlashni talab
  qilardi (Redis) — §4.1 ga ko'ra u startda yo'q.
- **Sessiyani darhol bekor qilib bo'lmaydi**: JWT bazada saqlanmaydi,
  shuning uchun amal muddati qisqa (24 soat).
- **`worker` Docker siz `.env` ni o'qimaydi.** `npm run worker` (`tsx`) Next.js
  dan farqli o'laroq `.env` ni avtomatik yuklamaydi, shuning uchun to'g'ridan-
  to'g'ri VM da ishga tushirilsa `DATABASE_URL o'rnatilmagan` bilan yiqiladi.
  Docker da muammo yo'q — o'zgaruvchilarni `docker-compose.yml` ning
  `environment:` bo'limi beradi. Konteynersiz sinash kerak bo'lsa:
  `node --env-file=.env` yoki `npx tsx --env-file=.env worker/index.ts`.
