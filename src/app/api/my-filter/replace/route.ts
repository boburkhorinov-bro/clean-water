import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/auth/require-admin';
import { createRateLimiter } from '@/server/rate-limit';
import { requestReplacement } from '@/server/services/replacement-request';
import { notifyManagers } from '@/server/telegram/notify-manager';

/**
 * «Mening filtrim» ekranidagi «Almashtirishga buyurtma» tugmasi (§2, §4.6).
 *
 * Telegram eslatmasidagi tugma bilan bir xil servisga boradi. Farqi shundaki,
 * bu yerda mijoz Mini App ichida va u kimligi SESSIYADAN olinadi — klient
 * yuborgan hech qanday identifikatordan emas (§6).
 */

const bodySchema = z.object({
  installedPartId: z.uuid(),
});

/** §6: forma tugmasiga rate-limit. Bir mijoz uchun soatiga 20 ta urinish. */
const limiter = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

/** Servis natijasi → HTTP statusi. */
const STATUS_CODES = {
  CREATED: 201,
  ALREADY_REQUESTED: 200,
  PHONE_REQUIRED: 422,
  NOT_FOUND: 404,
} as const;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const check = limiter.check(`tg:${session.telegramId}`);
  if (!check.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(check.retryAfterMs / 1000)) } },
    );
  }

  try {
    const result = await requestReplacement(
      {
        installedPartId: parsed.data.installedPartId,
        telegramId: BigInt(session.telegramId),
      },
      { notify: notifyManagers },
    );

    return NextResponse.json({ status: result.status }, { status: STATUS_CODES[result.status] });
  } catch (error) {
    console.error('[api/my-filter/replace] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
