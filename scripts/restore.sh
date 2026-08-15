#!/bin/sh
# Zaxiradan tiklash (§7).
#
#   DATABASE_URL="postgresql://..." sh scripts/restore.sh <dump-fayl> [--yes]
#
# DIQQAT: bu buzuvchi amal — mavjud jadvallar tashlab yuboriladi va o'rniga
# dump dagi holat qo'yiladi. Shuning uchun tasdiq talab qilinadi.
#
# Tiklashni sinash uchun `verify-restore.sh` dan foydalaning: u ishchi
# bazaga umuman tegmaydi.

set -eu
# shellcheck source=scripts/_pg-env.sh
. "$(dirname "$0")/_pg-env.sh"

DUMP="${1:-}"
CONFIRM="${2:-}"

if [ -z "$DUMP" ]; then
  echo "XATO: dump fayli ko‘rsatilmagan. Foydalanish: restore.sh <dump> [--yes]" >&2
  exit 2
fi

if [ ! -f "$DUMP" ]; then
  echo "XATO: fayl topilmadi: $DUMP" >&2
  exit 2
fi

if [ "$CONFIRM" != "--yes" ]; then
  # Interaktiv so'rov emas, ataylab qat'iy rad etish: skript cron dan yoki
  # boshqa skript ichidan chaqirilsa, so'rov javobsiz osilib qolardi.
  echo "XATO: tiklash $DB_NAME bazasidagi ma’lumotni almashtiradi." >&2
  echo "Tasdiqlash uchun ikkinchi argument sifatida --yes bering." >&2
  exit 3
fi

echo "[restore] $DUMP → $DB_NAME"

# `--clean --if-exists`: mavjud obyektlar avval tashlanadi. `--no-owner` —
# dump boshqa foydalanuvchi nomidan olingan bo'lishi mumkin.
#
# `--exit-on-error` ATAYLAB YO'Q: `--clean` bosqichida mavjud bo'lmagan
# obyektni tashlashga urinish ogohlantirish beradi va butun tiklashni
# to'xtatib qo'yardi. Natija pastda tekshiriladi.
"$PG_RESTORE" --clean --if-exists --no-owner --no-privileges \
  --dbname="$PG_URL" "$DUMP"

echo "[restore] tayyor"
