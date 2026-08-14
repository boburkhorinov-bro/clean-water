import { Montserrat } from 'next/font/google';

/**
 * TZ dizayn talabi: Montserrat.
 *
 * `next/font` shriftni build paytida yuklab oladi va O'ZIMIZNING domendan
 * uzatadi. Bu majburiy: nginx dagi CSP `font-src 'self' data:` deydi, ya'ni
 * `fonts.gstatic.com` ga to'g'ridan-to'g'ri murojaat bloklanadi.
 *
 * Yon foyda: shrift uchun tashqi so'rov yo'q — sahifa tezroq ochiladi va
 * foydalanuvchi Google ga kuzatilmaydi.
 */
export const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});
