import { NextResponse } from 'next/server';
import { issueFormToken } from '@/server/form-token';

/**
 * Ommaviy forma uchun imzolangan boshlanish payti (§6).
 *
 * Klient formani ochganda bu manzilni so'raydi va olingan tokenni ariza
 * bilan birga qaytaradi. Server shu bilan formaning to'ldirilish vaqtini
 * biladi — bot uni darhol yuboradi, odam esa yo'q.
 */

// Sahifalar ISR bilan keshlanadi, bu manzil esa hech qachon: keshlangan
// token barcha mijozlarga bitta bo'lib qolardi va bir sutkadan keyin
// birdaniga hamma ariza rad etilardi.
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Prodda bu holat bo'lmaydi — `checkProcessEnv` ilovani ko'tarilishga
    // qo'ymaydi. Dev da esa jim qolgandan ko'ra aniq xato yaxshi.
    console.error('[api/form-token] JWT_SECRET sozlanmagan');
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  return NextResponse.json(
    { token: issueFormToken(secret) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
