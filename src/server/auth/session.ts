import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

/**
 * Sessiya tokeni (§4.4, §4.10).
 *
 * Sessiyalar MB da saqlanmaydi — har so'rovda bazaga murojaat qilmaslik uchun.
 * Buning narxi: tokenni darhol bekor qilib bo'lmaydi, shuning uchun amal
 * muddati ataylab qisqa.
 */

export const SESSION_TTL_SECONDS = 24 * 60 * 60;

/** Cookie nomi — §4.4: httpOnly + Secure + SameSite. */
export const SESSION_COOKIE = 'cw_session';

const sessionPayloadSchema = z.object({
  userId: z.string().min(1),
  telegramId: z.string().min(1),
  role: z.enum(['CLIENT', 'ADMIN']),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

interface TokenOptions {
  now?: Date;
  ttlSeconds?: number;
}

function secretKey(secret: string): Uint8Array {
  if (!secret) throw new Error('JWT_SECRET o‘rnatilmagan.');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
  secret: string,
  options: TokenOptions = {},
): Promise<string> {
  const key = secretKey(secret);
  const now = options.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const ttl = options.ttlSeconds ?? SESSION_TTL_SECONDS;

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttl)
    .sign(key);
}

/**
 * Tokenni tekshiradi. Har qanday muammoda — imzo, muddat, kutilmagan mazmun —
 * `null` qaytaradi: chaqiruvchi uchun «sessiya yo'q» bilan «sessiya yaroqsiz»
 * o'rtasida farq yo'q, ikkalasi ham kirishni taqiqlaydi.
 */
export async function verifySessionToken(
  token: string,
  secret: string,
  options: { now?: Date } = {},
): Promise<SessionPayload | null> {
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ['HS256'],
      ...(options.now ? { currentDate: options.now } : {}),
    });

    // Imzo to'g'ri bo'lishi mazmun kutilganday ekanini anglatmaydi.
    const parsed = sessionPayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
