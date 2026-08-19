import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/auth/require-admin';
import { createRateLimiter } from '@/server/rate-limit';
import { savePhoneForTelegramUser } from '@/server/services/save-phone';

/**
 * Mini App dagi telefon formasi (§4.5).
 *
 * Telegram avtorizatsiyasi telefon bermaydi — faqat `telegram_id`. Shuning
 * uchun ilovaga birinchi kirgan mijozning `phone` maydoni bo'sh bo'ladi va
 * «Almashtirishga buyurtma» tugmasi unga ishlamaydi. Botdagi «Raqamni
 * yuborish» tugmasi bu muammoni chatda hal qiladi, bu marshrut esa ilovada:
 * mijoz allaqachon Mini App da bo'lsa, uni botga chiqarish ortiqcha qadam.
 *
 * §6: kim ekani SESSIYADAN olinadi. Klient yuborgan identifikatorga ishonib
 * bo'lmaydi — u bilan istalgan odam boshqa mijozning raqamini o'zgartirardi.
 */

const bodySchema = z.object({
  // Uzunlik chegarasi — normalizatsiya oldidan: `normalizePhone` ixtiyoriy
  // uzunlikdagi satrni qabul qiladi va uni tozalashga urinadi.
  phone: z.string().min(1).max(32),
});

/** §6: forma tugmasiga rate-limit. Bir mijoz uchun soatiga 20 ta urinish. */
const limiter = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

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
    const result = await savePhoneForTelegramUser({
      telegramId: BigInt(session.telegramId),
      phone: parsed.data.phone,
      // §6: forma raqamni TASDIQLAMAYDI — uni mijoz qo'lda yozadi va begona
      // raqam bo'lishi mumkin. Tasdiqlangan yo'l botda: «Raqamni yuborish»
      // tugmasida raqamni Telegram ning o'zi beradi.
      verified: false,
    });

    if (result.status === 'INVALID_PHONE') {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }

    // 409: so'rov to'g'ri, lekin raqam boshqa mijozda. 400 emas — mijoz
    // formani to'g'ri to'ldirgan va uni tuzatib bo'lmaydi; javob boshqa yo'l
    // ko'rsatishi kerak.
    if (result.status === 'PHONE_TAKEN') {
      return NextResponse.json({ error: 'phone_taken' }, { status: 409 });
    }

    return NextResponse.json({ status: 'SAVED' });
  } catch (error) {
    console.error('[api/my-filter/phone] kutilmagan xato', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
