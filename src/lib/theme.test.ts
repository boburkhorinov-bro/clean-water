import { describe, expect, test } from 'vitest';
import { THEME_STORAGE_KEY, isTheme, resolveTheme } from './theme';

/**
 * §3: «Mavzu Telegram dan olinadi, qo'lda ham almashtiriladi.»
 *
 * Uchta manba to'qnashadi va ustunlik tartibi muhim: agar Telegram har
 * ochilishda qo'lda tanlovni bosib ketsa, tugma ishlamayotgandek ko'rinadi.
 */
describe('resolveTheme', () => {
  test('qo‘lda tanlangan mavzu hammasidan ustun', () => {
    expect(resolveTheme({ stored: 'light', telegram: 'dark', system: 'dark' })).toBe('light');
    expect(resolveTheme({ stored: 'dark', telegram: 'light', system: 'light' })).toBe('dark');
  });

  test('qo‘lda tanlov yo‘q bo‘lsa Telegram mavzusi olinadi', () => {
    expect(resolveTheme({ stored: null, telegram: 'dark', system: 'light' })).toBe('dark');
  });

  test('Telegram ham yo‘q bo‘lsa tizim sozlamasi', () => {
    expect(resolveTheme({ stored: null, telegram: null, system: 'dark' })).toBe('dark');
  });

  test('hech narsa yo‘q bo‘lsa «Kun» — standart', () => {
    expect(resolveTheme({ stored: null, telegram: null, system: null })).toBe('light');
  });

  test('saqlangan qiymat buzuq bo‘lsa e’tiborga olinmaydi', () => {
    // localStorage ni foydalanuvchi ham, boshqa skript ham o'zgartirishi mumkin.
    expect(resolveTheme({ stored: 'binafsha', telegram: 'dark', system: null })).toBe('dark');
  });
});

describe('isTheme', () => {
  test('faqat ikkita qiymat joiz', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('tun')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe('THEME_STORAGE_KEY', () => {
  test('kalit nomlangan va o‘zgarmas — u brauzerlarda saqlanib qoladi', () => {
    expect(THEME_STORAGE_KEY).toBe('cw-theme');
  });
});
