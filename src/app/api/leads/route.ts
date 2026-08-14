import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/auth/require-admin';
import { createRateLimiter } from '@/server/rate-limit';
import { LeadValidationError, createLead } from '@/server/services/leads';
import { notifyManagers } from '@/server/telegram/notify-manager';

/**
 * Ariza qabul qilish (§4.5).
 *
 * Muhim tartib: validatsiya → rate-limit → baza → javob → xabarnoma.
 * Xabarnoma `createLead` ichida yuboriladi va uning nosozligi javobga
 * ta'sir qilmaydi.
 */

const bodySchema = z.object({
  phone: z.string().min(1).max(32),
  name: z.string().trim().max(120).optional(),
  productId: z.uuid().optional(),
  comment: z.string().trim().max(1000).optional(),
  source: z.enum(['MINIAPP', 'WEB']),
});

/**
 * §6: ariza formasiga rate-limit. Bir IP dan soatiga 10 ta ariza — haqiqiy
 * mijoz uchun yetarlidan ko'p, bot uchun sezilarli to'siq.
 *
 * nginx darajasida ham `limit_req` bor (docker/nginx/conf.d/default.conf);
 * bu ikkinchi qatlam, chunki nginx siz ishga tushirish ham mumkin.
 */
const ipLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
const telegramLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

function clientIp(request: Request): string {
  // nginx `X-Forwarded-For` qo'yadi (docker/nginx/conf.d/proxy_params.inc).
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
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

  // Sessiya bo'lsa — mijozni Telegram bo'yicha ham bog'laymiz (§4.5 dagi
  // dublikatlarni birlashtirish shunga tayanadi).
  const session = await getSession();
  const telegramId = session ? BigInt(session.telegramId) : undefined;

  const ipCheck = ipLimiter.check(`ip:${clientIp(request)}`);
  const tgCheck = telegramId
    ? telegramLimiter.check(`tg:${telegramId}`)
    : { allowed: true, retryAfterMs: 0 };

  if (!ipCheck.allowed || !tgCheck.allowed) {
    const retryAfterMs = Math.max(ipCheck.retryAfterMs, tgCheck.retryAfterMs);
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const lead = await createLead(
      {
        phone: parsed.data.phone,
        name: parsed.data.name,
        productId: parsed.data.productId,
        comment: parsed.data.comment,
        source: parsed.data.source,
        telegramId,
      },
      { notify: notifyManagers },
    );

    return NextResponse.json({ id: lead.id, status: lead.status }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return NextResponse.json({ error: 'invalid_lead' }, { status: 400 });
    }
    console.error('[api/leads] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
