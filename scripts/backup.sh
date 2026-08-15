#!/bin/sh
# Bazaning zaxira nusxasi (§7).
#
# Cron bo'yicha `backup` konteyneridan ishga tushadi (docker-compose.yml).
# Qo'lda:
#   DATABASE_URL="postgresql://..." BACKUP_DIR=/backups sh scripts/backup.sh
#
# Format — `custom` (`-Fc`): u siqilgan, `pg_restore` bilan tanlab tiklanadi
# va SQL matnidan ancha ixcham.

set -eu
# shellcheck source=scripts/_pg-env.sh
. "$(dirname "$0")/_pg-env.sh"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
# Kunlik zaxira uchun ikki hafta yetadi: bundan eskisi bilan tiklash
# ma'noga ega emas, joy esa cheksiz emas.
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

# Nomda vaqt ham bor: bir kunda bir necha marta ishga tushirilsa (qo'lda
# yoki deploydan oldin) oldingisi o'chib ketmasin.
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/cleanwater-$STAMP.dump"
# Avval vaqtinchalik nomga yoziladi: yarim yozilgan dump zaxira ro'yxatida
# turib, «zaxira bor» degan yolg'on ishonch berardi.
TEMP="$TARGET.partial"

cleanup_partial() {
  rm -f "$TEMP"
}
trap cleanup_partial EXIT

echo "[backup] $DB_NAME → $TARGET"
"$PG_DUMP" --format=custom --no-owner --no-privileges --file="$TEMP" "$PG_URL"

mv "$TEMP" "$TARGET"
trap - EXIT

SIZE="$(wc -c < "$TARGET" | tr -d ' ')"
echo "[backup] tayyor: $TARGET ($SIZE bayt)"

# Eskilarini tozalash. `-mtime +N` — N kundan eski fayllar.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'cleanwater-*.dump' -type f \
  -mtime "+$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')"
echo "[backup] saqlash muddati $RETENTION_DAYS kun, o‘chirildi: $DELETED"
