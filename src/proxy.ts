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
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    // Mini App, admin, API, Next.js ichki fayllari va media — chetlab o'tiladi.
    '/((?!app|admin|api|_next|media|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
