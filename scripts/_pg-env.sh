#!/bin/sh
# Zaxira skriptlari uchun umumiy sozlama (§7).
#
# Bu fayl mustaqil ishlamaydi — uni `backup.sh`, `restore.sh` va
# `verify-restore.sh` `source` qiladi.

set -eu

# PostgreSQL binarlari. Docker konteynerida ular PATH da, Windows da esa yo'q —
# o'shanda `PG_BIN` beriladi.
PG_BIN="${PG_BIN:-}"
if [ -n "$PG_BIN" ]; then
  PG_DUMP="$PG_BIN/pg_dump"
  PG_RESTORE="$PG_BIN/pg_restore"
  PSQL="$PG_BIN/psql"
else
  PG_DUMP="pg_dump"
  PG_RESTORE="pg_restore"
  PSQL="psql"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "XATO: DATABASE_URL berilmagan." >&2
  exit 2
fi

# Prisma ulanish satrida `?schema=public` bo'ladi; libpq bu parametrni
# bilmaydi va butun manzilni rad etadi. Query qismini olib tashlaymiz —
# sxema pg_dump uchun baribir standart `public`.
PG_URL="${DATABASE_URL%%\?*}"

# Baza nomi — manzilning oxirgi bo'lagi. Tekshiruv skriptiga vaqtinchalik
# baza nomini yasash uchun kerak.
DB_NAME="$(basename "$PG_URL")"
# Serverga ulanish (bazasiz) — `postgres` xizmat bazasi orqali.
SERVER_URL="${PG_URL%/*}/postgres"
