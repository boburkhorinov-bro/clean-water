import { describe, expect, test } from 'vitest';
import { formatPrice } from './format';

/**
 * Narx bazada `Decimal` va servisdan satr bo'lib keladi (aniqlik yo'qolmasligi
 * uchun). Ekranda esa o'qiladigan ko'rinishda bo'lishi kerak: so'mdagi narxlar
 * millionlarda va ajratgichsiz o'qib bo'lmaydi.
 */
describe('formatPrice', () => {
  test('minglar ajratiladi', () => {
    expect(formatPrice('2500000')).toBe('2 500 000');
  });

  test('nol o‘nliklar ko‘rsatilmaydi — so‘mda tiyin yo‘q', () => {
    expect(formatPrice('2500000.00')).toBe('2 500 000');
  });

  test('nolmas o‘nliklar saqlanadi', () => {
    expect(formatPrice('1234.50')).toBe('1 234,5');
  });

  test('kichik son', () => {
    expect(formatPrice('999')).toBe('999');
  });

  test('nol', () => {
    expect(formatPrice('0')).toBe('0');
  });

  test('son ko‘rinishida ham qabul qilinadi', () => {
    expect(formatPrice(150000)).toBe('150 000');
  });

  test('yaroqsiz qiymat xato tashlamaydi', () => {
    // Baza qo'lda tahrirlangan bo'lishi mumkin — sahifa yiqilmasligi kerak.
    expect(formatPrice('narx emas')).toBe('—');
    expect(formatPrice('')).toBe('—');
  });
});
