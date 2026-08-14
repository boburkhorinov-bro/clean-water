# Deploy tekshiruv ro'yxati

**Bu ro'yxat majburiy.** Docker stek ishlab chiqish mashinasida hech qachon
ishga tushirilmagan (u yerda 3.8 GB RAM va Docker Desktop ko'tarilmaydi),
shuning uchun `docker compose up` birinchi marta aynan serverda bajariladi.
Quyidagi qadamlar shu birinchi martani boshqariladigan qiladi.

Tartib muhim: har bir qadam o'zidan oldingisi ishlaganini tasdiqlaydi.

## 0. Server tayyorligi

```bash
docker --version && docker compose version
nproc && free -h && df -h /
```

Minimal talab: 2 GB RAM (`next build` uchun), 10 GB bo'sh joy.
Agar RAM 2 GB dan kam bo'lsa — `web` obrazini boshqa joyda qurib, registry
orqali olib kelish kerak, chunki build serverda yig'ilmaydi.

## 1. Sirlar

```bash
cp env.example .env
```

To'ldirilishi shart: `DATABASE_URL` (host `postgres`, `localhost` EMAS),
`POSTGRES_PASSWORD` (namunadagi `cleanwater` NI QOLDIRMANG),
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ADMIN_IDS`,
`TELEGRAM_MANAGER_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`,
`JWT_SECRET` (`openssl rand -base64 48`), `NEXT_PUBLIC_SITE_URL` (haqiqiy domen).

`NEXT_PUBLIC_SITE_URL` xato bo'lsa qidiruv tizimlariga `localhost` havolalari
ketadi (§4.7).

## 2. Konfiguratsiyani tekshirish — konteynerlarni ko'tarmasdan

```bash
docker compose config --quiet        # yaml va o'zgaruvchilar
docker run --rm -v "$PWD/docker/nginx/conf.d:/etc/nginx/conf.d:ro" nginx:1.29-alpine nginx -t
```

`nginx -t` `proxy_params.inc` ni `include` orqali topishi kerak. Agar u
`.conf` deb nomlansa, nginx uni http darajasida yuklab xato beradi — shuning
uchun kengaytma ataylab `.inc`.

## 3. Obrazlarni qurish

```bash
docker compose build web
docker compose build worker
```

`web` build i `prisma generate` ni ichida bajaradi va soxta `DATABASE_URL`
ishlatadi — bu normal, klient dangasa quriladi (`src/server/db.ts`).

## 4. Baza va migratsiya

```bash
docker compose up -d postgres
docker compose exec postgres pg_isready -U "$POSTGRES_USER"
docker compose run --rm web npx prisma migrate deploy
```

Migratsiyadan keyin §4.6 kafolatini tasdiqlang:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT indexdef FROM pg_indexes WHERE indexname='notifications_installed_part_id_kind_key';"
```

Bo'sh natija — eslatmalar dublikatlanadi degani. To'xtang va sababini toping.

## 5. To'liq stek

```bash
docker compose up -d
docker compose ps            # hammasi healthy bo'lishi kerak
curl -f http://localhost/api/health
curl -sI http://localhost/ | grep -i location    # /uz ga redirect
```

## 6. Xavfsizlik sarlavhalari

```bash
curl -sI http://localhost/uz | grep -iE "content-security-policy|x-frame-options|x-content-type"
```

Uchalasi ham bo'lishi kerak (§6).

## 7. Rate-limit ishlayaptimi

```bash
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost/api/leads \
    -H 'Content-Type: application/json' \
    -d '{"phone":"+998901234567","source":"WEB"}'
done; echo
```

Oxirida `429` chiqishi kerak. Faqat `201` ketsa — nginx `limit_req` ishlamayapti.

## 8. TLS

Domen va Let's Encrypt sertifikati tayyor bo'lgach,
`docker/nginx/conf.d/default.conf` dagi izohli TLS blokini yoqing va
`docker-compose.yml` dagi `/etc/letsencrypt` volume ini oching.

TLS siz **Mini App ishlamaydi**: sessiya cookie si prodda `Secure` bayrog'i
bilan qo'yiladi (Telegram iframe i uchun `SameSite=None` shart, u esa
`Secure` talab qiladi).

## 9. Zaxira nusxa

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup.sql.gz
```

Cron ga qo'ying **va tiklashni sinab ko'ring** — tekshirilmagan zaxira
zaxira emas (§6).

## Ma'lum farqlar: lokal va prod

| | Lokal (ishlab chiqish) | Prod |
|---|---|---|
| PostgreSQL | Windows da qo'lda, xizmat emas | `postgres` konteyneri |
| Baza hosti | `127.0.0.1` | `postgres` |
| Cookie | `SameSite=Lax`, `Secure` yo'q | `SameSite=None; Secure` |
| nginx | umuman yo'q | TLS, rate-limit, CSP, `/media` |
| Docker | ko'tarilmaydi | asosiy ishga tushirish usuli |

Ya'ni nginx qatlami (CSP sarlavhalari, `/media` uzatish, `limit_req`) lokal
ishlab chiqishda umuman sinovdan o'tmaydi — 2, 6 va 7-qadamlar shuning uchun.
