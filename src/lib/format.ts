/**
 * Narxni ekranga chiqarish uchun formatlaydi.
 *
 * Servis narxni SATR sifatida beradi (aniqlik yo'qolmasligi uchun), bu yerda
 * esa u o'qiladigan ko'rinishga keladi: so'mdagi narxlar millionlarda va
 * ajratgichsiz o'qib bo'lmaydi.
 *
 * Yaroqsiz qiymatda `—` qaytaradi: baza qo'lda tahrirlangan bo'lishi mumkin,
 * mahsulot sahifasi esa shu sababli yiqilmasligi kerak.
 */

const formatter = new Intl.NumberFormat('uz-UZ', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPrice(value: string | number): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || (typeof value === 'string' && value.trim() === '')) {
    return '—';
  }

  // `uz-UZ` minglarni uzilmas bo‘shliq (U+00A0) bilan ajratadi va shundayligicha
  // qoldiriladi: oddiy bo‘shliqqa almashtirilsa, narx qator oxirida «2 500»
  // va «000» bo‘lib sinib ketishi mumkin.
  return formatter.format(numeric);
}
