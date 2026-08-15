import { createHmac, timingSafeEqual } from 'node:crypto';
import { FORM_TOKEN_MAX_AGE_MS, FORM_TOKEN_MIN_AGE_MS } from '@/lib/form-token-timing';

/**
 * Ommaviy formalar uchun bot to'sig'i (§6: «spam himoyasi»).
 *
 * Server formani ochish paytini imzolab beradi, klient uni ariza bilan birga
 * qaytaradi. Shu bilan ikkita savolga javob olinadi: forma haqiqatan ham
 * bizning sahifamizdan ochilganmi va uni to'ldirishga vaqt sarflanganmi.
 * Vaqtni imzolamasdan klientga ishonib bo'lmasdi — bot shunchaki boshqa
 * son yuborardi.
 *
 * Token holat saqlamaydi (bazada ham, xotirada ham yo'q): `web` bir nechta
 * instansda ishga tushsa, bir instans bergan tokenni ikkinchisi tekshira
 * olishi kerak.
 */

// Vaqt chegaralari klientga ham kerak, shuning uchun ular `@/lib` da.
export { FORM_TOKEN_MAX_AGE_MS, FORM_TOKEN_MIN_AGE_MS };

export type FormTokenResult =
  { ok: true } | { ok: false; reason: 'invalid' | 'too_fast' | 'expired' };

/**
 * Sessiya kaliti bilan bir xil sirdan foydalaniladi, lekin kontekst
 * prefiksi bilan: bir maqsad uchun berilgan imzo ikkinchisiga yaramasin.
 */
function sign(secret: string, issuedAt: number): string {
  return createHmac('sha256', `form-token:${secret}`).update(String(issuedAt)).digest('base64url');
}

export function issueFormToken(secret: string, now: number = Date.now()): string {
  const issuedAt = Math.floor(now);
  return `${issuedAt.toString(36)}.${sign(secret, issuedAt)}`;
}

export function verifyFormToken(
  token: string | undefined | null,
  secret: string,
  { now = Date.now() }: { now?: number } = {},
): FormTokenResult {
  const invalid = { ok: false, reason: 'invalid' } as const;

  if (!secret || !token) return invalid;

  const parts = token.split('.');
  if (parts.length !== 2) return invalid;

  const [rawIssuedAt, signature] = parts as [string, string];
  const issuedAt = Number.parseInt(rawIssuedAt, 36);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return invalid;

  const expected = sign(secret, issuedAt);
  // Uzunliklar farq qilsa `timingSafeEqual` xato tashlaydi.
  if (signature.length !== expected.length) return invalid;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return invalid;

  const age = now - issuedAt;
  // Kelajakdagi token ham shu yerga tushadi (age manfiy) — bu to'g'ri:
  // «hali to'ldirilmagan» forma yuborilmaydi.
  if (age < FORM_TOKEN_MIN_AGE_MS) return { ok: false, reason: 'too_fast' };
  if (age > FORM_TOKEN_MAX_AGE_MS) return { ok: false, reason: 'expired' };

  return { ok: true };
}
