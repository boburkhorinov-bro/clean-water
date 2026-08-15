import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/locales';

/**
 * Ommaviy sayt marshrutlari doim til prefiksi bilan bo'ladi (§4.7).
 * Prefiksi yo'q so'rov standart tilga yo'naltiriladi.
 *
 * Mini App (`/app`), admin panel (`/admin`) va API (`/api`) tildan mustaqil —
 * ular bu yerda tegilmaydi (§4.3).
 *
 * Next.js 16 da bu konvensiya `middleware` emas, `proxy` deb ataladi.
 */

/**
 * Nuqtasi bor yo'l — bu fayl, sahifa emas.
 *
 * Fayllarni nom bo'yicha sanab chiqish bir marta qimmatga tushdi:
 * `manifest.webmanifest` va `icon.svg` ro'yxatga kirmay qolgan va `/uz/...`
 * ga yo'naltirilgan. Brauzer 307 ni kuzatib HTML olgan va uni jimgina
 * tashlab yuborgan — PWA manifesti ham, favicon ham ishlamagan.
 */
const FILE_PATH = /\.[^/]+$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (FILE_PATH.test(pathname)) return NextResponse.next();

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Mini App, admin, API, Next.js ichki fayllari va kengaytmali fayllar —
    // chetlab o'tiladi. Kengaytma qoidasi funksiya ichida ham takrorlanadi:
    // matcher o'zgarsa ham xatti-harakat buzilmasin.
    '/((?!app|admin|api|_next|.*\\..*).*)',
  ],
};
