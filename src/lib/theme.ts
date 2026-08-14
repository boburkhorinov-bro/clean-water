/**
 * Mavzu tanlash mantiqi (§3).
 *
 * Uchta manba bor va ustunlik tartibi muhim:
 *   1. foydalanuvchi QO'LDA tanlagani — hech narsa uni bosib ketmaydi
 *   2. Telegram mavzusi — Mini App nativ ko'rinishi uchun
 *   3. tizim sozlamasi — brauzerda
 *
 * Agar Telegram har ochilishda qo'lda tanlovni bekor qilsa, tugma buzilgandek
 * ko'rinadi. Shuning uchun saqlangan qiymat birinchi o'rinda.
 */

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** `light` — «Kun», TZ dagi standart holat. */
export const DEFAULT_THEME: Theme = 'light';

/** Brauzerda saqlanadigan kalit. O'zgartirilsa, mavjud tanlovlar yo'qoladi. */
export const THEME_STORAGE_KEY = 'cw-theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

interface ResolveInput {
  stored: string | null;
  telegram: string | null;
  system: string | null;
}

export function resolveTheme({ stored, telegram, system }: ResolveInput): Theme {
  // Saqlangan qiymat ishonchsiz manba: uni foydalanuvchi ham, boshqa skript
  // ham o'zgartirishi mumkin.
  if (isTheme(stored)) return stored;
  if (isTheme(telegram)) return telegram;
  if (isTheme(system)) return system;
  return DEFAULT_THEME;
}
