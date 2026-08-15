#!/bin/sh
# Deploydan keyingi tez tekshiruv (§7: relizga tayyorlik).
#
#   sh scripts/smoke.sh https://cleanwater.uz
#   sh scripts/smoke.sh http://localhost:3000
#
# Har bir tekshiruv — bitta savol: «bu yo'l tirikmi va o'zini kutilganday
# tutyaptimi». Skript birinchi nosozlikda to'xtamaydi: deploydan keyin
# muammolarning TO'LIQ ro'yxatini ko'rish kerak, bittasini emas.

set -u

BASE="${1:-http://localhost:3000}"
FAILED=0

check() {
  name="$1"
  expected="$2"
  path="$3"

  actual="$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")"
  if [ "$actual" = "$expected" ]; then
    echo "  OK    $name ($path → $actual)"
  else
    echo "  XATO  $name ($path → $actual, kutilgan $expected)"
    FAILED=$((FAILED + 1))
  fi
}

check_header() {
  name="$1"
  header="$2"
  path="$3"

  if curl -s -D - -o /dev/null "$BASE$path" | grep -qi "^$header:"; then
    echo "  OK    $name"
  else
    echo "  XATO  $name — «$header» sarlavhasi yo‘q ($path)"
    FAILED=$((FAILED + 1))
  fi
}

echo "[smoke] $BASE"
echo ""

echo "Asosiy yo‘llar:"
check "sog‘liq" 200 /api/health
check "o‘zbekcha bosh sahifa" 200 /uz
check "ruscha bosh sahifa" 200 /ru
check "filtrlar katalogi" 200 /uz/filtrlar
check "kartrijlar katalogi" 200 /uz/kartrijlar
check "til prefiksisiz manzil yo‘naltiriladi" 307 /
check "PWA manifesti" 200 /manifest.webmanifest
check "robots.txt" 200 /robots.txt
check "sitemap" 200 /sitemap.xml

echo ""
echo "Xavfsizlik:"
check_header "CSP sarlavhasi bor" "Content-Security-Policy" /uz
check_header "MIME sniffing o‘chirilgan" "X-Content-Type-Options" /uz
# Admin yo'llari 403 emas, 404 qaytaradi — panel va API mavjudligini
# oshkor qilmaslik uchun (`requireAdminOrNotFound`).
check "admin panel sessiyasiz yopiq" 404 /admin
check "admin API sessiyasiz yopiq" 404 /api/admin/products
check "forma tokeni beriladi" 200 /api/form-token

echo ""
echo "Spam himoyasi:"
# Tokensiz ariza rad etilishi kerak. Bu POST, shuning uchun alohida.
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/leads" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+998901234567","source":"WEB"}')"
if [ "$code" = "400" ]; then
  echo "  OK    tokensiz ariza rad etiladi (400)"
else
  echo "  XATO  tokensiz ariza $code qaytardi, 400 kutilgan"
  FAILED=$((FAILED + 1))
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "[smoke] hammasi joyida"
  exit 0
fi

echo "[smoke] nosozliklar: $FAILED"
exit 1
