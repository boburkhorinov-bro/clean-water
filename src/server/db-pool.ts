/**
 * Ulanishlar hovuzining o'lchami (§7).
 *
 * Yuklama tekshiruvida topilgan: 10 parallel so'rov PostgreSQL ning
 * `max_connections` limitini yeb qo'ydi va sahifalar 500 qaytardi. Har bir
 * `web`/`worker` jarayoni o'z hovuzini ochadi, ya'ni bazadagi limit
 * hovuzlar yig'indisidan katta bo'lishi kerak:
 *
 *     max_connections >= (web instanslari + worker) × DATABASE_POOL_MAX + zaxira
 *
 * Standart qiymat `pg` kutubxonasinikiga teng (10) — u bitta `web` va bitta
 * `worker` uchun Docker dagi standart `max_connections=100` ga bemalol
 * sig'adi. Kichik VPS da `max_connections` pasaytirilsa, bu o'zgaruvchi ham
 * pasaytiriladi.
 */

const DEFAULT_POOL_MAX = 10;

export function resolvePoolMax(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  // Xato yozilgan qiymat ishga tushishni bloklamaydi: hovuz o'lchami
  // shunchalik muhim emas, standart qiymat esa xavfsiz.
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_POOL_MAX;
  return parsed;
}
