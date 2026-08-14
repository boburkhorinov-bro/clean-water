import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Telegram Mini App `initData` ni serverda tekshirish (§4.4, §6).
 *
 * Algoritm core.telegram.org/bots/webapps bo'yicha:
 *   1. `hash` dan boshqa barcha maydonlar alifbo tartibida saralanadi va
 *      `key=value` ko'rinishida `\n` bilan qo'shiladi;
 *   2. maxfiy kalit = HMAC_SHA256(bot_token, "WebAppData");
 *   3. imzo = hex(HMAC_SHA256(data_check_string, maxfiy_kalit));
 *   4. `auth_date` ning yangiligi tekshiriladi.
 *
 * Klientdan kelgan hech narsaga ishonilmaydi: bu funksiya `false` qaytarsa,
 * so'rov shu yerda tugaydi.
 */

export interface TelegramUser {
  id: number;
  firstName: string | undefined;
  lastName: string | undefined;
  username: string | undefined;
  languageCode: string | undefined;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: Date;
  queryId: string | undefined;
}

export type InitDataFailureReason =
  | 'missing_bot_token'
  | 'missing_hash'
  | 'hash_mismatch'
  | 'missing_auth_date'
  | 'expired'
  | 'invalid_user';

export type InitDataResult =
  { ok: true; data: VerifiedInitData } | { ok: false; reason: InitDataFailureReason };

/** Standart yaroqlilik muddati — §4.4: 24 soatdan eski bo'lmasligi kerak. */
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

interface VerifyOptions {
  maxAgeSeconds?: number;
  now?: Date;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function parseUser(raw: string | null): TelegramUser | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.id !== 'number' || !Number.isFinite(candidate.id)) return null;

  const asString = (value: unknown): string | undefined =>
    typeof value === 'string' ? value : undefined;

  return {
    id: candidate.id,
    firstName: asString(candidate.first_name),
    lastName: asString(candidate.last_name),
    username: asString(candidate.username),
    languageCode: asString(candidate.language_code),
  };
}

export function verifyInitData(
  initData: string,
  botToken: string,
  options: VerifyOptions = {},
): InitDataResult {
  // Sozlama xatosi (token bo'sh) hech qachon ochiq eshikka aylanmasligi kerak.
  if (!botToken) return { ok: false, reason: 'missing_bot_token' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };

  // `hash` dan boshqa hamma narsa imzo hisobiga kiradi — yangi `signature`
  // maydoni ham, aks holda yangi klientlar rad etiladi.
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!safeEqualHex(hash, expected)) return { ok: false, reason: 'hash_mismatch' };

  // Imzo to'g'ri bo'lgandan keyingina mazmunga ishonamiz.
  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) return { ok: false, reason: 'missing_auth_date' };

  const authDateSeconds = Number(authDateRaw);
  if (!Number.isFinite(authDateSeconds)) return { ok: false, reason: 'missing_auth_date' };

  const now = options.now ?? new Date();
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDateSeconds;
  if (ageSeconds > maxAge) return { ok: false, reason: 'expired' };

  const user = parseUser(params.get('user'));
  if (!user) return { ok: false, reason: 'invalid_user' };

  return {
    ok: true,
    data: {
      user,
      authDate: new Date(authDateSeconds * 1000),
      queryId: params.get('query_id') ?? undefined,
    },
  };
}
