#!/bin/sh
# Zaxirani HAQIQATAN tiklab ko'rish (§7).
#
#   DATABASE_URL="postgresql://..." sh scripts/verify-restore.sh [dump-fayl]
#
# Fayl ko'rsatilmasa `BACKUP_DIR` dagi eng yangi zaxira olinadi.
#
# Nega kerak: tekshirilmagan zaxira — zaxira emas. Buziladigan joy odatda
# yozishda emas, tiklashda: format mos kelmaydi, dump yarim yozilgan,
# huquqlar yetmaydi. Buni ma'lumot yo'qolgan kunda bilib olish juda kech.
#
# Skript ISHCHI BAZAGA TEGMAYDI: u vaqtinchalik baza yaratadi, dump ni
# o'sha yerga tiklaydi, jadvallarni sanaydi va bazani o'chiradi.

set -eu
# shellcheck source=scripts/_pg-env.sh
. "$(dirname "$0")/_pg-env.sh"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DUMP="${1:-}"

if [ -z "$DUMP" ]; then
  DUMP="$(find "$BACKUP_DIR" -maxdepth 1 -name 'cleanwater-*.dump' -type f \
    | sort | tail -n 1)"
fi

if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "XATO: tekshirish uchun zaxira topilmadi ($BACKUP_DIR)" >&2
  exit 2
fi

CHECK_DB="${DB_NAME}_restore_check_$$"
CHECK_URL="${PG_URL%/*}/$CHECK_DB"

drop_check_db() {
  "$PSQL" --dbname="$SERVER_URL" --quiet --no-psqlrc \
    -c "DROP DATABASE IF EXISTS \"$CHECK_DB\" WITH (FORCE)" > /dev/null 2>&1 || true
}
# Skript qanday tugashidan qat'i nazar vaqtinchalik baza qolmaydi: aks holda
# har bir tekshiruv serverga bittadan «axlat» baza qo'shib borardi.
trap drop_check_db EXIT

echo "[verify] zaxira: $DUMP"
echo "[verify] vaqtinchalik baza: $CHECK_DB"

"$PSQL" --dbname="$SERVER_URL" --quiet --no-psqlrc \
  -c "CREATE DATABASE \"$CHECK_DB\"" > /dev/null

# Tiklash chiqishi ogohlantirishlar bilan to'la bo'lishi mumkin; xatolarni
# quyida natija bo'yicha aniqlaymiz.
if ! "$PG_RESTORE" --no-owner --no-privileges --dbname="$CHECK_URL" "$DUMP" 2>/tmp/verify-restore.$$.log; then
  echo "XATO: pg_restore yiqildi:" >&2
  tail -n 20 "/tmp/verify-restore.$$.log" >&2
  rm -f "/tmp/verify-restore.$$.log"
  exit 1
fi
rm -f "/tmp/verify-restore.$$.log"

TABLES="$("$PSQL" --dbname="$CHECK_URL" --quiet --no-psqlrc --tuples-only --no-align \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"

if [ "$TABLES" -eq 0 ]; then
  # Bo'sh dump ham «muvaffaqiyatli» tiklanadi — shuning uchun natija
  # sanaladi, jarayonning chiqish kodi yetarli emas.
  echo "XATO: tiklangan bazada bitta ham jadval yo‘q." >&2
  exit 1
fi

echo "[verify] tiklandi: $TABLES jadval"

# Har bir jadvaldagi qatorlar soni — zaxira mazmunli ekaniga dalil.
#
# Bu yerda `pg_stat_user_tables.n_live_tup` ISHLATILMAYDI: u taxminiy
# hisoblagich va tiklashdan keyin darhol nol bo'lib turishi mumkin
# (statistika autovacuum bilan yangilanadi). Nol ko'rsatgan tekshiruv esa
# bo'sh zaxirani ham «sog'lom» deb o'tkazib yuborardi. Shuning uchun har bir
# jadval haqiqatan sanaladi.
"$PSQL" --dbname="$CHECK_URL" --quiet --no-psqlrc --tuples-only --no-align -c "
  SELECT c.relname || ': ' || (
    xpath('/row/cnt/text()', query_to_xml(
      format('SELECT count(*) AS cnt FROM %I.%I', n.nspname, c.relname),
      false, true, ''
    ))
  )[1]::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname = 'public'
  ORDER BY c.relname
"

echo "[verify] tekshiruv muvaffaqiyatli"
