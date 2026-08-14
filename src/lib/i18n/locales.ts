/**
 * §4.7 — tillar URL da: `/uz/...` va `/ru/...`.
 * Indekslash uchun alohida URL lar kerak, shuning uchun manzilni
 * o'zgartirmasdan til almashtirish qo'llanilmaydi.
 */
export const LOCALES = ['uz', 'ru'] as const;

export type Locale = (typeof LOCALES)[number];

/** Yetishmayotgan tarjima bo'shliq emas, o'zbek tiliga tushadi (§4.7). */
export const DEFAULT_LOCALE: Locale = 'uz';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
