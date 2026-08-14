import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales';

/**
 * Ikkala tilni bitta yozuvda saqlaydigan matn (§4.7).
 *
 * `| undefined` ataylab yozilgan: `exactOptionalPropertyTypes` yoqilgan, ya'ni
 * `{ uz: undefined }` bilan `{}` bir xil emas. zod dan chiqadigan tiplar esa
 * aynan birinchi ko'rinishda bo'ladi.
 */
export type LocalizedText = { [K in Locale]?: string | undefined };

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim().length > 0 ? value : undefined;
}

/**
 * Berilgan til uchun matnni tanlaydi.
 *
 * §4.7: yetishmayotgan tarjima bo'shliq ko'rsatmaydi, o'zbekchaga tushadi.
 * O'zbekchasi ham bo'lmasa — mavjud istalgan tilni beradi, chunki bo'sh
 * sarlavha saytda buzuqlik bo'lib ko'rinadi.
 */
export function localized(text: LocalizedText, locale: Locale): string {
  return (
    nonEmpty(text[locale]) ??
    nonEmpty(text[DEFAULT_LOCALE]) ??
    LOCALES.map((candidate) => nonEmpty(text[candidate])).find((value) => value !== undefined) ??
    ''
  );
}
