import { describe, expect, test } from 'vitest';
import { normalizePhone } from './phone';

/**
 * §4.5: «Telefonni `+998XXXXXXXXX` ko'rinishiga normallashtirish → mavjud
 * mijozni qidirish → dublikatlarni birlashtirish.»
 *
 * Normalizatsiya — dublikat birlashtirishning tayanchi. Agar bir odam
 * `90 123 45 67` va `+998901234567` deb ikki xil yozsa va biz ularni bir xil
 * ko'rinishga keltirmasak, bazada ikkita mijoz paydo bo'ladi — va uning
 * kartrij eslatmalari ikkiga bo'linib ketadi.
 */
describe('normalizePhone', () => {
  test('kanonik ko‘rinish o‘zgarishsiz qoladi', () => {
    expect(normalizePhone('+998901234567')).toBe('+998901234567');
  });

  test('plyus siz 998 bilan boshlangan raqam', () => {
    expect(normalizePhone('998901234567')).toBe('+998901234567');
  });

  test('faqat 9 xonali lokal raqam', () => {
    expect(normalizePhone('901234567')).toBe('+998901234567');
  });

  test('bo‘shliqlar olib tashlanadi', () => {
    expect(normalizePhone('+998 90 123 45 67')).toBe('+998901234567');
  });

  test('qavs va chiziqcha olib tashlanadi', () => {
    expect(normalizePhone('(90) 123-45-67')).toBe('+998901234567');
  });

  test('998 bilan boshlangan, ichida ajratgichlari bor raqam', () => {
    expect(normalizePhone('998-90-123-45-67')).toBe('+998901234567');
  });

  test('boshidagi 0 tashlanadi (0 90 ... ko‘rinishi)', () => {
    expect(normalizePhone('0901234567')).toBe('+998901234567');
  });

  test('bo‘sh satr rad etiladi', () => {
    expect(normalizePhone('')).toBeNull();
  });

  test('faqat bo‘shliq rad etiladi', () => {
    expect(normalizePhone('   ')).toBeNull();
  });

  test('juda qisqa raqam rad etiladi', () => {
    expect(normalizePhone('12345')).toBeNull();
  });

  test('juda uzun raqam rad etiladi', () => {
    expect(normalizePhone('+9989012345678901')).toBeNull();
  });

  test('O‘zbekiston kodi bo‘lmagan raqam rad etiladi', () => {
    // Platforma O'zbekiston uchun. Boshqa mamlakat raqamini «to'g'rilab»
    // qabul qilish — bazaga axlat yozish demak.
    expect(normalizePhone('+79001234567')).toBeNull();
  });

  test('harflar bo‘lsa rad etiladi', () => {
    expect(normalizePhone('90abc4567')).toBeNull();
  });

  test('undefined va null xato tashlamaydi', () => {
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  test('turli yozuvlar bir xil natijaga keladi — dublikat birlashtirish shunga tayanadi', () => {
    const variants = [
      '+998901234567',
      '998901234567',
      '901234567',
      '+998 90 123 45 67',
      '(90) 123-45-67',
    ];
    const normalized = new Set(variants.map((v) => normalizePhone(v)));

    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe('+998901234567');
  });
});
