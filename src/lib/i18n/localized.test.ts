import { describe, expect, test } from 'vitest';
import { localized } from './localized';

/**
 * §4.7: «Yetishmayotgan tarjima bo'shliq ko'rsatmaydi, o'zbek tiliga tushadi.»
 *
 * Bu shunchaki qulaylik emas — bo'sh sarlavhali mahsulot kartochkasi
 * saytda buzuqlik bo'lib ko'rinadi va SEO da ham zarar.
 */
describe('localized', () => {
  test('so‘ralgan til mavjud bo‘lsa, o‘shani qaytaradi', () => {
    expect(localized({ uz: 'Filtr', ru: 'Фильтр' }, 'ru')).toBe('Фильтр');
  });

  test('so‘ralgan tarjima yo‘q bo‘lsa, o‘zbekchaga tushadi', () => {
    expect(localized({ uz: 'Filtr' }, 'ru')).toBe('Filtr');
  });

  test('so‘ralgan tarjima bo‘sh satr bo‘lsa ham o‘zbekchaga tushadi', () => {
    expect(localized({ uz: 'Filtr', ru: '' }, 'ru')).toBe('Filtr');
  });

  test('faqat bo‘shliqdan iborat tarjima ham yo‘q deb hisoblanadi', () => {
    expect(localized({ uz: 'Filtr', ru: '   ' }, 'ru')).toBe('Filtr');
  });

  test('o‘zbekchasi ham yo‘q bo‘lsa, mavjud boshqa tilni qaytaradi', () => {
    expect(localized({ ru: 'Фильтр' }, 'uz')).toBe('Фильтр');
  });

  test('hech qanday tarjima yo‘q bo‘lsa, bo‘sh satr qaytaradi va xato tashlamaydi', () => {
    expect(localized({}, 'uz')).toBe('');
  });
});
