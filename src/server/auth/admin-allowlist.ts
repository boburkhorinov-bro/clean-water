/**
 * Bootstrap adminlar (§4.4).
 *
 * `TELEGRAM_ADMIN_IDS` — birlamchi adminlarni berish uchun yagona yo'l;
 * keyingi adminlar admin panel orqali `User.role` ga yoziladi.
 *
 * Telegram ID lari `bigint` da saqlanadi: ular 2^53 dan oshishi mumkin va
 * `number` da yaxlitlanib, boshqa odamning ID siga aylanib qolishi mumkin.
 */

function toId(value: string | number | bigint): bigint | null {
  try {
    const id = typeof value === 'bigint' ? value : BigInt(String(value).trim());
    return id > 0n ? id : null;
  } catch {
    return null;
  }
}

/** Muhit o'zgaruvchisidagi vergul bilan ajratilgan ro'yxatni o'qiydi. */
export function parseAdminIds(raw: string | undefined): bigint[] {
  if (!raw) return [];

  const seen = new Set<bigint>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // `BigInt('12.5')` va `BigInt('admin')` xato tashlaydi — toId uni yutadi.
    const id = toId(trimmed);
    if (id !== null) seen.add(id);
  }

  return [...seen];
}

/**
 * Berilgan Telegram ID bootstrap adminlar ro'yxatidami.
 *
 * Ro'yxat bo'sh bo'lsa — hech kim admin emas. Bu ataylab: sozlama yo'qligi
 * hech qachon "hammaga ruxsat" degani bo'lmasligi kerak.
 */
export function isBootstrapAdmin(
  telegramId: string | number | bigint,
  raw: string | undefined,
): boolean {
  const id = toId(telegramId);
  if (id === null) return false;

  return parseAdminIds(raw).includes(id);
}
