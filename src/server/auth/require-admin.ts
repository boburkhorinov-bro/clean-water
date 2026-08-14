import { cookies } from 'next/headers';
import { SESSION_COOKIE, type SessionPayload, verifySessionToken } from './session';

/**
 * §3, §4.4: «Klientdagi ko'rinuvchanlik — himoya emas. Huquqlar har bir
 * so'rovda serverda tekshiriladi.»
 *
 * Interfeysdagi admin tumbleri faqat boshqaruv elementlarini ko'rsatadi;
 * haqiqiy tekshiruv shu yerda.
 */

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return verifySessionToken(token, process.env.JWT_SECRET ?? '');
}

export class NotAuthorizedError extends Error {
  constructor() {
    super('not_authorized');
    this.name = 'NotAuthorizedError';
  }
}

/**
 * Admin sessiyasini talab qiladi. Rol tokendan o'qiladi, klient yuborgan
 * hech qanday bayroqdan emas.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') throw new NotAuthorizedError();
  return session;
}
