#!/bin/sh
# `backup` konteynerining kirish nuqtasi (§7).
#
# Har kuni `BACKUP_HOUR` da zaxira oladi va uni darhol tiklab ko'radi.
#
# Nega cron emas: busybox `crond` bola jarayonga konteyner muhitini to'liq
# bermaydi va `DATABASE_URL` yo'qolib qolardi. Buni faqat birinchi tiklash
# kerak bo'lgan kuni bilib olardik. Oddiy tsiklda esa muhit o'zgarmaydi.
#
# Sinov uchun: `BACKUP_ONCE=1` — bitta qadam bajariladi va chiqiladi.

set -eu

HERE="$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
# Tunda: kunduzgi yuklamaga xalaqit bermaydi.
BACKUP_HOUR="${BACKUP_HOUR:-03}"
# Tekshiruv vaqtinchalik baza yaratadi; katta bazada uni o'chirish mumkin.
VERIFY_RESTORE="${VERIFY_RESTORE:-1}"
# Tsikl qadamlari orasidagi tanaffus. Soatiga bir necha marta uyg'onish
# yetarli: kunlik marker takroriy zaxirani to'sadi.
SLEEP_SECONDS="${SLEEP_SECONDS:-600}"

mkdir -p "$BACKUP_DIR"

step() {
  hour="$(date +%H)"
  today="$(date +%Y%m%d)"
  marker="$BACKUP_DIR/.done-$today"

  if [ "$hour" != "$BACKUP_HOUR" ]; then
    return 0
  fi

  # Kunlik marker: konteyner qayta ishga tushsa yoki tsikl soat ichida
  # bir necha marta uyg'onsa, zaxira takrorlanib joyni to'ldirardi.
  if [ -f "$marker" ]; then
    return 0
  fi

  sh "$HERE/backup.sh"

  if [ "$VERIFY_RESTORE" = "1" ]; then
    sh "$HERE/verify-restore.sh"
  fi

  # Marker faqat hammasi muvaffaqiyatli tugagach qo'yiladi: yiqilgan
  # urinishdan keyin keyingi uyg'onishda qayta urinib ko'riladi.
  touch "$marker"

  # Eski markerlarni tozalash — ular faqat joriy kun uchun ma'noga ega.
  find "$BACKUP_DIR" -maxdepth 1 -name '.done-*' -type f -mtime +2 -delete
}

if [ "${BACKUP_ONCE:-0}" = "1" ]; then
  step
  exit 0
fi

echo "[backup-loop] jadval: har kuni soat $BACKUP_HOUR:00 ($(date +%Z)), papka: $BACKUP_DIR"

while true; do
  step
  sleep "$SLEEP_SECONDS"
done
