import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from '@/server/auth/session';
import { verifyInitData } from '@/server/auth/telegram-init-data';
import { upsertTelegramUser } from '@/server/repositories/user-repository';

const bodySchema = z.object({
  initData: z.string().min(1),
});

/**
 * Mini App avtorizatsiyasi (§4.4).
 *
 * `initData` ning HMAC imzosi bot tokeni bilan tekshiriladi; imzo to'g'ri
 * bo'lgandagina foydalanuvchi yaratiladi va sessiya beriladi.
 */
export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const jwtSecret = process.env.JWT_SECRET ?? '';

  // Sozlama xatosini 401 sifatida ko'rsatmaymiz: bu klientning aybi emas va
  // uni yashirish nosozlikni topishni qiyinlashtiradi.
  if (!botToken || !jwtSecret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const body = bodySchema.safeParse(raw);
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const verified = verifyInitData(body.data.initData, botToken);
  if (!verified.ok) {
    // Sabab javobda qaytarilmaydi — u hujumchiga imzoni tanlashda yordam beradi.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const user = await upsertTelegramUser({
    telegramId: BigInt(verified.data.user.id),
    firstName: verified.data.user.firstName,
    lastName: verified.data.user.lastName,
    languageCode: verified.data.user.languageCode,
  });

  const token = await createSessionToken(
    {
      userId: user.id,
      telegramId: String(verified.data.user.id),
      role: user.role,
    },
    jwtSecret,
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({
    user: { id: user.id, name: user.name, lang: user.lang, role: user.role },
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    // Mini App Telegram ning iframe i ichida ochiladi — bu uchinchi tomon
    // konteksti, shuning uchun prodda `none` bo'lishi shart, aks holda cookie
    // umuman yuborilmaydi. Lokal HTTP da `none` brauzer tomonidan rad etiladi
    // (u `Secure` talab qiladi), shuning uchun dev da `lax`.
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}
