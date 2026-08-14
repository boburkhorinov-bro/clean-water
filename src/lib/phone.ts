/**
 * Telefon raqamini `+998XXXXXXXXX` ko'rinishiga keltiradi (§4.5).
 *
 * Bu funksiya dublikat birlashtirishning kalitini beradi: bir odam raqamini
 * necha xil yozmasin, bazada bitta yozuv bo'lishi kerak. Aks holda uning
 * kartrij eslatmalari ikkita profilga bo'linib ketadi.
 *
 * Normallashtirib bo'lmasa `null` — chaqiruvchi buni validatsiya xatosi
 * sifatida ko'rsatadi. «Taxminan to'g'ri» raqamni qabul qilishdan ko'ra
 * mijozdan qayta so'rash arzon.
 */

const COUNTRY_CODE = '998';
/** O'zbekiston abonent raqami operator kodi bilan birga 9 xonali. */
const SUBSCRIBER_DIGITS = 9;

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Faqat raqam, bo'shliq, qavs, chiziqcha va boshidagi plyus ruxsat etiladi.
  // Harf uchrasa — bu telefon raqami emas.
  if (!/^\+?[\d\s()\-.]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === SUBSCRIBER_DIGITS) {
    return `+${COUNTRY_CODE}${digits}`;
  }

  // `0 90 123 45 67` ko'rinishi — ichki terish shakli.
  if (digits.length === SUBSCRIBER_DIGITS + 1 && digits.startsWith('0')) {
    return `+${COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (
    digits.length === COUNTRY_CODE.length + SUBSCRIBER_DIGITS &&
    digits.startsWith(COUNTRY_CODE)
  ) {
    return `+${digits}`;
  }

  return null;
}
