# Clean Water — Vercel + Render + Neon

Bu hujjat **tanlangan yo'l** (qaror: 2026-08-20). Docker/VPS varianti
[DEPLOY.md](DEPLOY.md) da qoladi va u hech qayerga ketmaydi: `docker-compose.yml`,
`scripts/deploy.sh` va migratsiya xizmati ishlaydigan holatda.

## Nima qayerda turadi

| Qism | Xizmat | Reja |
|---|---|---|
| Sayt, Mini App, admin panel, API | **Vercel** | Hobby |
| `worker` — bot webhooki va eslatmalar | **Render** | Free (web service) |
| PostgreSQL | **Neon** | Free |
| Eslatmalarni ishga tushirish | **cron-job.org** (yoki shunga o'xshash) | Free |
| Video | Kinescope | Free |

nginx yo'q. Xavfsizlik sarlavhalari allaqachon ilovada
(`src/lib/security-headers.ts` + `next.config.ts`), shuning uchun nginx
yo'qolishi himoyani olib ketmaydi.

## Bilib turishingiz kerak bo'lgan uchta narsa

**1. Vercel Hobby shartlarida tijoriy foydalanish taqiqlangan.** Vercel
«tijoriy» ni keng ta'riflaydi: mahsulot reklama qilinishi ham, saytni
yaratganga haq to'langani ham shunga kiradi. Bu platforma ikkala ta'rifga
ham tushadi. Rasmiy yo'l — Pro ($20/oy). Hobby bilan ishlash **egasining
qarori** (2026-08-20); xavf — hisob to'xtatilishi.

**2. Render bepul xizmati 15 daqiqa bekorchilikdan keyin uxlaydi.**
Uyg'onish ~1 daqiqa. Shuning uchun eslatmalar jarayon ichidagi taymerga
emas, **tashqi cron** ga tayanadi (§4). Bot tugmasi birinchi bosishda
kechikishi mumkin — Telegram javob kelmasa updateni qayta yuboradi, ya'ni
ariza yo'qolmaydi.

**3. Rate-limit bu stekda kuchsizlanadi.** U jarayon xotirasida va Vercel
da har bir instansda alohida. nginx dagi `limit_req` ham yo'qoladi. Ariza
formasida honeypot va imzolangan forma tokeni qoladi (§6) — ular ishlaydi,
lekin oddiy flood ga qarshi qatlam endi yo'q.

---

## 1. Neon — baza

1. [neon.tech](https://neon.tech) da loyiha yarating, mintaqa: Frankfurt.
2. Ikkita ulanish satrini oling — ular **farq qiladi**:
   - **Pooled** (`...-pooler.<region>.aws.neon.tech`) — ilova uchun;
   - **Direct** (`-pooler` siz) — migratsiyalar uchun.

**Migratsiya pooled satr bilan ishlamaydi.** PgBouncer transaction rejimida
sessiya darajasidagi advisory lock larni uzatmaydi, Prisma esa migratsiyani
aynan shunday qulflaydi. Xato tushunarsiz bo'ladi va uni qidirishga vaqt
ketadi.

Migratsiyalarni **o'z mashinangizdan** qo'llang:

```bash
DATABASE_URL="<DIRECT satr>" npx prisma migrate deploy
```

Keyinchalik sxema o'zgarsa, shu buyruq qayta bajariladi — deploydan **oldin**.

Demo katalog kerak bo'lsa (ixtiyoriy):

```bash
DATABASE_URL="<DIRECT satr>" npm run db:seed
```

## 2. Vercel — sayt

1. Repozitoriyni import qiling. Framework: Next.js (o'zi aniqlaydi).
2. Muhit o'zgaruvchilari (Production):

| Nom | Qiymat |
|---|---|
| `DATABASE_URL` | Neon ning **pooled** satri |
| `DATABASE_POOL_MAX` | `3` |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `TELEGRAM_BOT_TOKEN` | BotFather dan |
| `TELEGRAM_BOT_USERNAME` | bot nomi, `@` siz |
| `TELEGRAM_ADMIN_IDS` | vergul bilan, sizning Telegram ID ingiz |
| `NEXT_PUBLIC_SITE_URL` | `https://<loyiha>.vercel.app` |

**`NEXT_PUBLIC_SITE_URL` qurish paytida kodga muhrlanadi.** Uni
o'zgartirsangiz (masalan o'z domeningizga o'tsangiz) — **qayta deploy**
qiling, aks holda canonical, hreflang, `robots.txt` va `sitemap.xml`
eski manzilda qoladi. Ilova ko'tariladi va sahifalar 200 qaytaradi, ya'ni
buzilish faqat qidiruv indeksida ko'rinadi.

`DATABASE_POOL_MAX` kichik bo'lishi shart: serverless da har bir instans
o'z hovuzini ochadi va ular Neon ning ulanish limitini tez yeb qo'yadi.

**`DATABASE_URL` build paytida ham kerak.** Bosh sahifa va katalog ro'yxatlari
ISR bilan oldindan quriladi (`revalidate = 60`), ya'ni `next build` bazaga
boradi. Ulanmasa build `Error occurred prerendering page "/uz"` bilan
yiqiladi va sabab darhol ko'rinmaydi — Vercel da env o'zgaruvchisi
Production build ga ham berilganini tekshiring. Bu lokal ravishda
tasdiqlangan: baza o'chirilganda build aynan shunday yiqildi.

Neon compute bekorchilikdan keyin uxlaydi; build paytidagi birinchi ulanish
uni uyg'otadi va bir necha soniya kutadi. Bu normal.

3. Deploy qiling va `https://<loyiha>.vercel.app/api/health` javob berishini
   tekshiring.

### Mahsulot rasmlari

Rasm yuklash interfeysi yo'q — admin panelda rasm **manzili** yoziladi
(`/media/...`). Fayllarni repozitoriydagi `public/media/` papkasiga qo'ying
va commit qiling; Vercel ularni CDN dan uzatadi.

Ya'ni yangi rasm qo'shish = commit + deploy. 3–5 mahsulot uchun bu normal;
rasm ko'payganda obyekt-saqlagichga (Vercel Blob, R2) o'tish kerak bo'ladi.

## 3. Render — worker

1. Render da **Blueprint** yarating va repozitoriyni ulang — u ildizdagi
   [`render.yaml`](../render.yaml) ni o'qiydi.
2. Panelda `sync: false` bilan belgilangan qiymatlarni kiriting:

| Nom | Qiymat |
|---|---|
| `DATABASE_URL` | Neon ning **pooled** satri |
| `TELEGRAM_BOT_TOKEN` | BotFather dan |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `TELEGRAM_MANAGER_CHAT_ID` | menejerlar guruhi ID si (manfiy son) |
| `CRON_SECRET` | `openssl rand -hex 32` |

Bittasi bo'sh qolsa xizmat **ataylab ko'tarilmaydi** (`src/server/env.ts`) —
jimgina buzilgan worker eng yomon variant bo'lardi.

3. Xizmat manzilini yozib oling: `https://cleanwater-worker.onrender.com`.
   Tekshirish: `curl https://<worker>/health` → `ok`.

## 4. Eslatmalarni ishga tushiruvchi cron

Bepul Render xizmati uxlaydi, ya'ni jarayon ichidagi 09:00 taymeriga
tayanib bo'lmaydi. Tashqi cron xizmati har kuni so'rov yuboradi — so'rov
konteynerni uyg'otadi va o'tishni boshlaydi.

[cron-job.org](https://cron-job.org) da (yoki shunga o'xshash bepul
xizmatda) ish yarating:

| Sozlama | Qiymat |
|---|---|
| URL | `https://<worker>/jobs/reminders` |
| Usul | `POST` |
| Jadval | har kuni **04:00 UTC** (Toshkent 09:00) |
| Sarlavha | `Authorization: Bearer <CRON_SECRET>` |

Qo'lda tekshirish:

```bash
curl -X POST https://<worker>/jobs/reminders \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Javob — o'tish natijasi: `{"sent":0,"skipped":0,"failed":0,...}`.

Nima kutish kerak:

- **401** — sir mos kelmadi yoki `CRON_SECRET` xizmatda sozlanmagan.
- **500** — o'tish yiqildi. Cron xizmati buni tarixida qizil ko'rsatadi va
  sizga xat yuboradi. Aynan shuning uchun bu holat 200 bilan yashirilmaydi.

Ikki marta ishga tushish **xavfsiz**: eslatmalar idempotentligi kodda emas,
bazada — `notifications` dagi `(installed_part_id, kind)` unikal indeksi.
Shu sababli jarayon ichidagi taymer ham olib tashlanmadi: u zaxira, chunki
tashqi cron xizmati ham to'xtab qolishi mumkin.

## 5. Telegram

Webhook **worker ga** ketadi (Vercel ga emas — u yerda bot yo'q):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<worker>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["callback_query","message"]'
```

`allowed_updates` dagi ikkala turi ham kerak: `callback_query` — eslatmadagi
«Almashtirishga buyurtma» tugmasi, `message` — telefonsiz mijoz ulashgan
kontakt va `/start` (§4.5). `message` tushib qolsa kontakt hech qayerga
yetib bormaydi va log da xato ko'rinmaydi.

Mini App esa **Vercel domeniga** ulanadi:

```
@BotFather -> /mybots -> <bot> -> Bot Settings -> Menu Button
manzil: https://<loyiha>.vercel.app/app
```

Bu ikki xil narsa: webhook ulangani Mini App ni ochmaydi.

## 6. Zaxira

`docker-compose.yml` dagi kunlik `pg_dump` xizmati bu yo'lda yo'q.

- Neon ning o'z tiklash oynasi bor (bepul rejada cheklangan) — uni Neon
  panelidan tekshiring.
- Skriptlar joyida: o'z mashinangizdan istalgan paytda dump olish mumkin.
  `scripts/backup.sh` `DATABASE_URL` ni o'qiydi, ya'ni **direct** satr bilan
  ishlaydi.

Bepul xizmatlarda SLA yo'q. Zaxirani vaqti-vaqti bilan o'z diskingizga
olib qo'ying.

## 7. Cheklist

- [ ] Neon loyihasi yaratildi, **direct** satr bilan `prisma migrate deploy` bajarildi
- [ ] Vercel da barcha env lar to'ldirildi, `NEXT_PUBLIC_SITE_URL` haqiqiy domen
- [ ] `https://<sayt>/api/health` javob beradi
- [ ] `https://<sayt>/uz` ochiladi, `/uz/filtrlar` da mahsulot ko'rinadi
- [ ] Render blueprint dan xizmat yaratildi, `sync: false` qiymatlari kiritildi
- [ ] `https://<worker>/health` → `ok`
- [ ] `setWebhook` bajarildi, `getWebhookInfo` da xato yo'q
- [ ] cron-job.org da ish yaratildi va **qo'lda bir marta** ishga tushirildi
      (javob 200)
- [ ] Mini App BotFather da ro'yxatdan o'tkazildi va Telegramda ochiladi
- [ ] Sinov arizasi menejerlar guruhiga yetib bordi
- [ ] `public/media/` ga mahsulot rasmlari qo'yildi

## 8. Nima o'zgarganini bilib turing

Bu yo'lda quyidagilar **yo'q**:

| Docker da bor edi | PaaS da |
|---|---|
| nginx `limit_req` (ariza formasiga to'siq) | yo'q |
| Kunlik `pg_dump` + tiklashni tekshirish | qo'lda yoki Neon PITR |
| `/media/` doimiy diskda | `public/media/`, commit orqali |
| Uzluksiz ishlaydigan worker | uxlaydi; cron uyg'otadi |
| Bitta joyda hammasi (`docker compose ps`) | uchta panel |
