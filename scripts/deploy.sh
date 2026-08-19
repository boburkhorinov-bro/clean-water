#!/bin/sh
# Clean Water — serverda deploy (§7).
#
#   sh scripts/deploy.sh <pochta>
#
# `docs/DEPLOY.md` §3–§5 dagi qadamlarni ketma-ket bajaradi: obrazlarni
# quradi, migratsiyalarni qo'llaydi, sertifikat oladi, TLS ni yoqadi va
# Telegram webhookini ulaydi. Pochta faqat Let's Encrypt uchun — sertifikat
# tugash arafasida ogohlantirish o'shanga keladi.
#
# **Idempotent**: qayta ishga tushirish xavfsiz. Allaqachon bajarilgan
# qadamlar (sertifikat olingan, TLS yoqilgan) o'tkazib yuboriladi, shuning
# uchun yarim yo'lda uzilib qolgan deployni shu skriptni qayta chaqirib
# davom ettirish mumkin.
#
# DIQQAT: skript ishlab chiqish mashinasida sinalmagan — u yerda Docker
# ko'tarilmaydi (3.8 GB xotira, CLAUDE.md). Shu sababli har qadam natija
# bo'yicha tekshiriladi va yiqilganda nima qilish kerakligi aytiladi:
# jimgina davom etib, oxirida «tayyor» deb yozadigan skript bu yerda eng
# yomon variant bo'lardi.

set -eu

EMAIL="${1:-}"
COMPOSE="docker compose"

step() {
  echo ""
  echo "──────────────────────────────────────────────────────────────"
  echo "  $1"
  echo "──────────────────────────────────────────────────────────────"
}

fail() {
  echo "" >&2
  echo "XATO: $1" >&2
  [ $# -gt 1 ] && echo "      $2" >&2
  exit 1
}

# `.env` dan bitta qiymatni oladi. `source` qilinmaydi: fayl ichida
# skriptning o'z o'zgaruvchilarini bosib ketadigan nomlar bo'lishi mumkin.
env_value() {
  grep -E "^$1=" .env 2>/dev/null | head -n1 | cut -d= -f2- | sed 's/^"//;s/"$//'
}

# ── 1. Muhit ───────────────────────────────────────────────────────────────
step "1/8  Muhit tekshiruvi"

[ -f docker-compose.yml ] || fail "docker-compose.yml topilmadi." \
  "Skriptni loyiha ildizidan ishga tushiring: sh scripts/deploy.sh <pochta>"

command -v docker > /dev/null 2>&1 || fail "docker o'rnatilmagan." \
  "docs/DEPLOY-FREE.md, «Docker» bo'limiga qarang."

$COMPOSE version > /dev/null 2>&1 || fail "docker compose plugin i yo'q." \
  "sudo apt install -y docker-compose-v2"

docker info > /dev/null 2>&1 || fail "docker ga ulanib bo'lmadi." \
  "Guruh a'zoligi kuchga kirmagan bo'lishi mumkin — SSH sessiyasini yopib qayta kiring."

[ -f .env ] || fail ".env topilmadi." "cp env.example .env va qiymatlarni to'ldiring."

SITE_URL="$(env_value NEXT_PUBLIC_SITE_URL)"
[ -n "$SITE_URL" ] || fail ".env da NEXT_PUBLIC_SITE_URL yo'q."

case "$SITE_URL" in
  https://*) ;;
  *) fail "NEXT_PUBLIC_SITE_URL https:// bilan boshlanishi shart (hozir: $SITE_URL)." \
       "Bu qiymat obrazga QURISH paytida muhrlanadi — docs/DEPLOY.md §2." ;;
esac

DOMAIN="${SITE_URL#https://}"
DOMAIN="${DOMAIN%%/*}"

case "$DOMAIN" in
  localhost*|127.*|"") fail "NEXT_PUBLIC_SITE_URL da haqiqiy domen yo'q ($DOMAIN)." ;;
esac

echo "  domen: $DOMAIN"

# `.env` dagi eng qimmat ikkita xato — ikkalasi ham deployni oxirigacha
# olib boradi va faqat ilova bazaga ulanmoqchi bo'lganda ko'rinadi.
DB_URL="$(env_value DATABASE_URL)"
[ -n "$DB_URL" ] || fail ".env da DATABASE_URL yo'q."

# `env.example` dagi namuna qiymat `localhost` — u LOKAL ishlab chiqish
# uchun. Konteyner ichida `localhost` konteynerning o'zi bo'ladi va baza
# topilmaydi; compose tarmog'ida host xizmat nomi, ya'ni `postgres`.
case "$DB_URL" in
  *@localhost:*|*@127.0.0.1:*)
    fail "DATABASE_URL konteyner ichida ishlamaydi (host: localhost)." \
      "Docker tarmog'ida host xizmat nomi bo'ladi: ...@postgres:5432/..." ;;
esac

# `POSTGRES_PASSWORD` bazani YARATADI, `DATABASE_URL` unga ULANADI. Ular
# ajralib qolsa, xato `web` loglarida `password authentication failed`
# bo'lib qoladi va sababi darhol ko'rinmaydi.
PG_PASSWORD="$(env_value POSTGRES_PASSWORD)"
URL_PASSWORD="$(printf '%s' "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')"

if [ -n "$PG_PASSWORD" ] && [ "$PG_PASSWORD" != "$URL_PASSWORD" ]; then
  fail "POSTGRES_PASSWORD va DATABASE_URL dagi parol mos kelmaydi." \
    "Ikkalasida bir xil qiymat bo'lishi shart — docs/TODO-OWNER.md §1."
fi

# Bepul subdomenlarda `www.` varianti mavjud emas: DuckDNS bitta nomga
# bitta A-yozuvi beradi. Uni sertifikatga qo'shish butun so'rovni yiqitadi.
CERT_DOMAINS="-d $DOMAIN"
SERVER_NAMES="$DOMAIN"
case "$DOMAIN" in
  *.duckdns.org|*.nip.io|*.sslip.io)
    echo "  www. varianti so'ralmaydi (bepul subdomen)" ;;
  *)
    CERT_DOMAINS="$CERT_DOMAINS -d www.$DOMAIN"
    SERVER_NAMES="$DOMAIN www.$DOMAIN" ;;
esac

# ── 2. DNS ─────────────────────────────────────────────────────────────────
step "2/8  DNS tekshiruvi"

# Sertifikat so'rashdan OLDIN tekshiriladi: Let's Encrypt domenni HTTP orqali
# tekshiradi va DNS hali eski bo'lsa urinish behuda ketadi, ko'p urinish esa
# soatlik limitga tushiradi (haftada 5 ta muvaffaqiyatsiz urinish).
SERVER_IP="$(curl -s --max-time 10 https://api.ipify.org || echo '')"
DOMAIN_IP="$(getent hosts "$DOMAIN" 2>/dev/null | head -n1 | awk '{print $1}' || echo '')"

echo "  server IP : ${SERVER_IP:-aniqlanmadi}"
echo "  domen IP  : ${DOMAIN_IP:-aniqlanmadi}"

if [ -z "$DOMAIN_IP" ]; then
  fail "$DOMAIN hech qanday IP ga qaramayapti." \
    "DuckDNS panelida IP ni yozib, tarqalishini kuting (bir necha daqiqa)."
fi

if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
  fail "$DOMAIN boshqa serverga qaraydi ($DOMAIN_IP, bu server $SERVER_IP)." \
    "DuckDNS panelida IP ni yangilang."
fi

# ── 3. Obrazlar va xizmatlar ───────────────────────────────────────────────
step "3/8  Obrazlarni qurish va xizmatlarni ko'tarish"
echo "  Birinchi qurish ARM da uzoq ketadi (Next.js build ~1.5 GB yeydi)."

# Migratsiyalar shu yerda ham qo'llanadi: `migrate` — bir martalik xizmat va
# `web` uning muvaffaqiyatli tugashini kutadi (docker-compose.yml).
$COMPOSE up -d --build \
  || fail "Xizmatlar ko'tarilmadi." \
    "Migratsiyalar yiqilgan bo'lishi mumkin: $COMPOSE logs migrate | tail -50"

# ── 4. Migratsiyalar ───────────────────────────────────────────────────────
step "4/8  Migratsiyalar"

# Bu yerga yetib kelgan bo'lsak, ular allaqachon qo'llangan — `web` boshqacha
# ko'tarilmasdi. Baribir tekshiramiz: jimgina o'tkazib yuborilgan migratsiya
# eng qimmat nosozlik — ilova eski sxemada ishlaydi va buni faqat mijoz
# sezadi.
MIGRATE_CID="$($COMPOSE ps -aq migrate 2>/dev/null | head -n1)"

if [ -z "$MIGRATE_CID" ]; then
  fail "migrate konteyneri topilmadi." \
    "docker-compose.yml da migrate xizmati bormi? $COMPOSE config --services"
fi

MIGRATE_CODE="$(docker inspect --format '{{.State.ExitCode}}' "$MIGRATE_CID" 2>/dev/null || echo '')"

if [ "$MIGRATE_CODE" != "0" ]; then
  fail "Migratsiyalar yiqildi (exit=${MIGRATE_CODE:-aniqlanmadi})." \
    "$COMPOSE logs migrate | tail -50"
fi

echo "  migratsiyalar qo'llandi"

# ── 5. Sog'liq ─────────────────────────────────────────────────────────────
step "5/8  Xizmatlar javob berishini kutish"

READY=0
for _ in $(seq 1 60); do
  if curl -sf --max-time 5 http://localhost/api/health > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 5
done

[ "$READY" = 1 ] || fail "Ilova 5 daqiqada javob bermadi." \
  "$COMPOSE ps va $COMPOSE logs web | tail -50"

echo "  /api/health javob beryapti"

# ── 6. Smoke (HTTP) ────────────────────────────────────────────────────────
step "6/8  Smoke tekshiruvi — HTTP"

sh scripts/smoke.sh "http://$DOMAIN" || fail "HTTP smoke tekshiruvi yiqildi." \
  "TLS ga o'tishdan oldin buni tuzating."

# ── 7. TLS ─────────────────────────────────────────────────────────────────
step "7/8  TLS"

if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "  sertifikat allaqachon bor — o'tkazib yuborildi"
else
  [ -n "$EMAIL" ] || fail "Sertifikat uchun pochta kerak." \
    "sh scripts/deploy.sh siz@pochta.com"

  # shellcheck disable=SC2086
  docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v cleanwater_certbot-webroot:/var/www/certbot \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    $CERT_DOMAINS --email "$EMAIL" --agree-tos --no-eff-email \
    || fail "Sertifikat olinmadi." \
      "80-port tashqaridan ochiqmi? Oracle da u IKKI joyda yopiq bo'ladi — docs/DEPLOY-FREE.md §3."
fi

if [ -f docker/nginx/conf.d/tls.conf ]; then
  echo "  tls.conf allaqachon yoqilgan — o'tkazib yuborildi"
else
  # Ikkala konfiguratsiya bir vaqtda yuklanmaydi: har ikkisida `listen 80`
  # bor va ikkinchisi birinchisini soya qilib qo'yardi.
  sed -e "s|/etc/letsencrypt/live/example\.uz|/etc/letsencrypt/live/$DOMAIN|g" \
      -e "s|server_name example\.uz www\.example\.uz;|server_name $SERVER_NAMES;|g" \
      docker/nginx/conf.d/tls.conf.disabled > docker/nginx/conf.d/tls.conf

  if grep -q 'example\.uz' docker/nginx/conf.d/tls.conf; then
    rm -f docker/nginx/conf.d/tls.conf
    fail "tls.conf da 'example.uz' qoldi — shablon o'zgargan." \
      "docker/nginx/conf.d/tls.conf.disabled ni qo'lda tahrirlang (docs/DEPLOY.md §4)."
  fi

  mv docker/nginx/conf.d/default.conf docker/nginx/conf.d/default.conf.disabled

  if ! $COMPOSE exec -T nginx nginx -t; then
    mv docker/nginx/conf.d/default.conf.disabled docker/nginx/conf.d/default.conf
    rm -f docker/nginx/conf.d/tls.conf
    fail "nginx konfiguratsiyasi noto'g'ri — HTTP holatiga qaytarildi."
  fi

  $COMPOSE exec -T nginx nginx -s reload
  echo "  TLS yoqildi"
fi

# ── 8. Telegram webhook ────────────────────────────────────────────────────
step "8/8  Telegram webhook"

BOT_TOKEN="$(env_value TELEGRAM_BOT_TOKEN)"
WEBHOOK_SECRET="$(env_value TELEGRAM_WEBHOOK_SECRET)"

if [ -z "$BOT_TOKEN" ] || [ -z "$WEBHOOK_SECRET" ]; then
  echo "  TASHLAB KETILDI: .env da TELEGRAM_BOT_TOKEN yoki TELEGRAM_WEBHOOK_SECRET yo'q"
else
  RESULT="$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
    -d "url=https://$DOMAIN/telegram/webhook" \
    -d "secret_token=$WEBHOOK_SECRET" \
    -d 'allowed_updates=["callback_query","message"]')"

  case "$RESULT" in
    *'"ok":true'*) echo "  webhook ulandi" ;;
    *) fail "Webhook ulanmadi: $RESULT" ;;
  esac
fi

# ── Yakuniy tekshiruv ──────────────────────────────────────────────────────
step "Yakuniy smoke tekshiruvi — HTTPS"

sh scripts/smoke.sh "https://$DOMAIN"

cat <<EOF

──────────────────────────────────────────────────────────────
  Deploy tugadi: https://$DOMAIN
──────────────────────────────────────────────────────────────

Qolgan ikkita ish qo'lda bajariladi:

1. Mini App ni BotFather da ro'yxatdan o'tkazing — docs/DEPLOY.md §5.1.
   Webhook ulangani Mini App ni OCHMAYDI, bu ikki xil narsa:
     /mybots -> bot -> Bot Settings -> Menu Button
     manzil: https://$DOMAIN/app

2. Sertifikatni yangilash uchun cron — docs/DEPLOY.md §4 oxirida.
   Usiz sayt 90 kundan keyin sertifikatsiz qoladi.

EOF
