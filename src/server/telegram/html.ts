/**
 * Telegram ning HTML rejimi uchun zarur minimal ekranlash.
 *
 * Xabarlarga mijoz kiritgan matn (ism, izoh) va admin kiritgan matn (mahsulot
 * nomi) tushadi. Ular ekranlanmasa: eng yaxshi holatda Telegram xabarni
 * «buzuq HTML» deb rad etadi va u yetib bormaydi, eng yomonida — matn ichiga
 * soxta havola qo'yiladi.
 */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
